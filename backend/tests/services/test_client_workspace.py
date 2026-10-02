import asyncio
from datetime import date
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from app.core.exceptions import AppError
from app.domain.client_care import current_care_by_client
from app.schemas.progress_note import NoteEntryCreate
from app.services.progress_note_service import ProgressNoteService


def test_current_care_excludes_proposed_future_and_ended_revisions():
    client_id = uuid4()
    def need(version, **changes):
        return SimpleNamespace(**dict(dict(client_id=client_id, version=version, activated_at=date(2026, 9, 28),
            imported=False, effective_from=date(2026, 9, 28), scheduled_from=date(2026, 9, 28), ends_on=None), **changes))
    current = need(3, ends_on=date(2026, 10, 4))
    future = need(4, scheduled_from=date(2026, 10, 5))
    proposed = need(5, activated_at=None, scheduled_from=None)
    records = [proposed, future, current]
    assert current_care_by_client(records, date(2026, 10, 1))[client_id] is current
    assert current_care_by_client(records, date(2026, 10, 5))[client_id] is future
    assert not current_care_by_client([current], date(2026, 10, 5))
    baseline = need(1, imported=True, activated_at=None)
    assert current_care_by_client([baseline, proposed], date(2026, 10, 1))[client_id] is baseline


def service(entries):
    svc = ProgressNoteService.__new__(ProgressNoteService)
    svc.db, svc.shift_repo, svc.note_repo = MagicMock(), MagicMock(), MagicMock()
    svc.org_id = uuid4()
    svc.current_user = SimpleNamespace(id=uuid4())
    svc.note_repo.get_by_shift_and_date.return_value = SimpleNamespace(entries=entries) if entries is not None else None
    return svc


def payload(count=1):
    return NoteEntryCreate(occurrence_date='2026-10-01', time='12:00', content='Follow-up: client comfortable.', expected_entry_count=count)


def test_append_retains_original_note_and_uses_shared_lock():
    original = [{'time': '10:00', 'content': 'Original entry'}]
    svc, shift_id = service(original), uuid4()
    result = asyncio.run(svc.append_entry(shift_id, payload()))
    svc.shift_repo.lock_shift.assert_called_once_with(shift_id, svc.org_id)
    svc.note_repo.get_shift.assert_called_once_with(shift_id, svc.org_id)
    assert result.entries[0] == original[0]
    assert len(result.entries) == 2 and len(original) == 1
    svc.db.commit.assert_called_once()


def test_stale_note_is_rejected_without_overwriting():
    svc = service([{'time': '10:00', 'content': 'One'}, {'time': '11:00', 'content': 'Two'}])
    with pytest.raises(AppError) as exc:
        asyncio.run(svc.append_entry(uuid4(), payload()))
    assert exc.value.code == 'NOTE_CHANGED'
    assert len(svc.note_repo.get_by_shift_and_date.return_value.entries) == 2
    svc.db.commit.assert_not_called()
    svc.db.rollback.assert_called_once()


def test_other_agency_shift_stops_before_notes_are_read():
    svc = service([])
    svc.shift_repo.lock_shift.side_effect = AppError(404, 'NOT_FOUND', 'Shift not found')
    with pytest.raises(AppError):
        asyncio.run(svc.append_entry(uuid4(), payload(0)))
    svc.note_repo.get_by_shift_and_date.assert_not_called()
    svc.db.commit.assert_not_called()


def test_new_note_requires_a_real_occurrence():
    svc = service(None)
    with patch('app.services.progress_note_service.shift_has_occurrence_on', return_value=False):
        with pytest.raises(AppError) as exc:
            asyncio.run(svc.append_entry(uuid4(), payload(0)))
    assert exc.value.status_code == 404
    svc.note_repo.add.assert_not_called()
    svc.db.commit.assert_not_called()


def test_admin_append_route_requires_auth_and_validates_payload():
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.api.routes.progress_notes import router, get_progress_note_service

    app = FastAPI()
    app.include_router(router)
    client = TestClient(app)
    url = f'/shifts/{uuid4()}/notes/entries'
    body = payload().model_dump(mode='json')
    assert client.post(url, json=body).status_code == 401
    svc = MagicMock()
    app.dependency_overrides[get_progress_note_service] = lambda: svc
    assert client.post(url, json={**body, 'expected_entry_count': -1}).status_code == 422
    assert client.post(url, json={**body, 'content': '   '}).status_code == 422
    svc.append_entry.assert_not_called()
