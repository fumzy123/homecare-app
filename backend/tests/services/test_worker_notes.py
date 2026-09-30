from datetime import date, datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.api.routes.worker_notes import get_worker_note_service, router
from app.core.enums import EmploymentStatus, OrgMemberRole, ShiftCompletionStatus
from app.core.exceptions import AppError
from app.schemas.progress_note import WorkerNoteEntryCreate
from app.services.worker_note_service import WorkerNoteService


def service():
    value = WorkerNoteService.__new__(WorkerNoteService)
    value.db = MagicMock()
    value.note_repo = MagicMock()
    value.shift_repo = MagicMock()
    value.org_id, value.worker_id = uuid4(), uuid4()
    value.agency_timezone = 'America/St_Johns'
    shift = SimpleNamespace(
        id=uuid4(), start_time=datetime(2025, 1, 6, 10), end_time=datetime(2025, 1, 6, 12),
        is_recurring=False, modifications=[], service_type=None, location=None, notes=None,
    )
    value.shift_repo.get_active_shift_for_worker.return_value = shift
    value.note_repo.get_by_shift_and_date.return_value = None
    return value, shift


def payload(**changes):
    return WorkerNoteEntryCreate(**dict(occurrence_date=date(2025, 1, 6), time='11:30',
                                       content='  Supported meal preparation.  ', expected_entry_count=0, **changes))


def test_worker_can_add_first_note_to_own_started_visit():
    svc, shift = service()
    note = svc.add_entry(shift.id, payload())
    assert note.entries == [{'time': '11:30', 'content': 'Supported meal preparation.'}]
    svc.shift_repo.get_active_shift_for_worker.assert_called_once_with(shift.id, svc.org_id, svc.worker_id)
    svc.shift_repo.lock_shift.assert_called_once_with(shift.id, svc.org_id)
    svc.db.commit.assert_called_once()


def test_append_preserves_existing_entries_and_rejects_stale_count():
    svc, shift = service()
    note = SimpleNamespace(entries=[{'time': '10:00', 'content': 'Existing admin entry'}])
    svc.note_repo.get_by_shift_and_date.return_value = note
    stale = payload()
    with pytest.raises(AppError) as error:
        svc.add_entry(shift.id, stale)
    assert error.value.code == 'NOTE_CHANGED'
    assert len(note.entries) == 1
    svc.db.rollback.assert_called_once()
    fresh = stale.model_copy(update={'expected_entry_count': 1})
    svc.add_entry(shift.id, fresh)
    assert len(note.entries) == 2
    assert note.entries[0]['content'] == 'Existing admin entry'
    # Retrying the same request cannot silently append it a second time.
    with pytest.raises(AppError):
        svc.add_entry(shift.id, fresh)
    assert len(note.entries) == 2


@pytest.mark.parametrize('method', ['read', 'write'])
def test_unassigned_or_foreign_tenant_shift_never_exposes_notes(method):
    svc, shift = service()
    svc.shift_repo.get_active_shift_for_worker.side_effect = AppError(404, 'NOT_FOUND', 'Shift occurrence not found')
    with pytest.raises(AppError):
        if method == 'read':
            svc.get_note(shift.id, date(2025, 1, 6))
        else:
            svc.add_entry(shift.id, payload())
    svc.note_repo.get_by_shift_and_date.assert_not_called()
    svc.db.commit.assert_not_called()


def test_nonexistent_recurring_occurrence_is_rejected():
    svc, shift = service()
    shift.is_recurring = True
    shift.recurrence_rule = 'FREQ=WEEKLY;BYDAY=MO'
    shift.recurrence_end_date = date(2025, 2, 1)
    with pytest.raises(AppError):
        svc.get_note(shift.id, date(2025, 1, 7))
    svc.note_repo.get_by_shift_and_date.assert_not_called()


@pytest.mark.parametrize('status', [ShiftCompletionStatus.cancelled, ShiftCompletionStatus.dropped, ShiftCompletionStatus.no_show])
def test_cancelled_dropped_and_missed_visits_cannot_receive_entries(status):
    svc, shift = service()
    shift.modifications = [SimpleNamespace(id=uuid4(), original_date=date(2025, 1, 6),
        new_start_time=None, new_end_time=None, notes=None, completion_status=status)]
    with pytest.raises(AppError) as error:
        svc.add_entry(shift.id, payload())
    assert error.value.code == 'SHIFT_NOT_DOCUMENTABLE'
    svc.db.commit.assert_not_called()


def test_start_check_uses_agency_timezone_and_modified_start():
    svc, shift = service()
    shift.modifications = [SimpleNamespace(id=uuid4(), original_date=date(2025, 1, 6),
        new_start_time=datetime(2026, 9, 30, 11), new_end_time=datetime(2026, 9, 30, 12),
        notes=None, completion_status=ShiftCompletionStatus.scheduled)]
    with patch('app.services.worker_note_service.datetime') as clock:
        clock.now.return_value = datetime(2026, 9, 30, 12, tzinfo=timezone.utc)  # 09:30 agency time
        with pytest.raises(AppError) as error:
            svc.add_entry(shift.id, payload())
    assert error.value.code == 'SHIFT_NOT_STARTED'
    svc.db.commit.assert_not_called()


def test_failed_save_rolls_back():
    svc, shift = service()
    svc.db.commit.side_effect = RuntimeError('DB failure')
    with pytest.raises(RuntimeError):
        svc.add_entry(shift.id, payload())
    svc.db.rollback.assert_called_once()


def test_recorded_summary_excludes_blank_notes_and_limits_range():
    svc, shift = service()
    svc.note_repo.list_for_worker.return_value = [
        SimpleNamespace(shift_id=shift.id, occurrence_date=date(2025, 1, 6), entries=[{'content': 'Care recorded'}]),
        SimpleNamespace(shift_id=uuid4(), occurrence_date=date(2025, 1, 6), entries=[{'content': '  '}]),
    ]
    result = svc.recorded_occurrences(date(2025, 1, 1), date(2025, 1, 7))
    assert result == [{'shift_id': shift.id, 'occurrence_date': date(2025, 1, 6)}]
    svc.note_repo.list_for_worker.assert_called_once_with(svc.org_id, svc.worker_id, date(2025, 1, 1), date(2025, 1, 7))
    for start, end in [(date(2025, 1, 7), date(2025, 1, 1)), (date(2025, 1, 1), date(2025, 3, 1))]:
        with pytest.raises(AppError):
            svc.recorded_occurrences(start, end)


@pytest.mark.parametrize('content,time', [(' ', '10:00'), ('text', '25:00'), ('a' * 10001, '10:00')])
def test_entry_validation(content, time):
    with pytest.raises(ValidationError):
        WorkerNoteEntryCreate(occurrence_date=date(2025, 1, 6), time=time, content=content, expected_entry_count=0)


@pytest.mark.parametrize('role,status', [(OrgMemberRole.owner, EmploymentStatus.active), (OrgMemberRole.home_support_worker, EmploymentStatus.terminated)])
def test_worker_guard_rejects_other_roles_and_inactive_employment(role, status):
    with patch('app.services.worker_note_service.OrganizationRepository') as repo:
        repo.return_value.get_active_employment_for_user.return_value = SimpleNamespace(role=role, employment_status=status)
        with pytest.raises(AppError) as error:
            WorkerNoteService(MagicMock(), SimpleNamespace(id=uuid4()))
        assert error.value.status_code == 403


def test_routes_validate_identifiers_dates_and_payload_before_writes():
    app = FastAPI()
    app.include_router(router)
    svc = MagicMock()
    app.dependency_overrides[get_worker_note_service] = lambda: svc
    client = TestClient(app)
    assert client.post('/me/shifts/not-a-uuid/notes', json={}).status_code == 422
    assert client.post(f'/me/shifts/{uuid4()}/notes', json={
        'occurrence_date': '2025-01-06', 'time': '12:00', 'content': ' ', 'expected_entry_count': 0,
    }).status_code == 422
    assert client.get('/me/notes/recorded?from_date=bad&to_date=2025-01-01').status_code == 422
    svc.add_entry.assert_not_called()


def test_routes_require_authentication():
    app = FastAPI()
    app.include_router(router)
    client = TestClient(app)
    shift_id = uuid4()
    for response in [
        client.get('/me/notes/recorded?from_date=2025-01-01&to_date=2025-01-07'),
        client.get(f'/me/shifts/{shift_id}/notes?occurrence_date=2025-01-06'),
        client.post(f'/me/shifts/{shift_id}/notes', json=payload().model_dump(mode='json')),
    ]:
        assert response.status_code == 401
