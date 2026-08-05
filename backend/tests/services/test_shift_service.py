import asyncio
from datetime import date, datetime
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.core.enums import OrgMemberRole
from app.core.exceptions import AppError
from app.schemas.shift import ShiftUpdateSchema
from app.services.shift_service import ShiftService


def _service(role=OrgMemberRole.manager):
    service = ShiftService.__new__(ShiftService)
    service.current_member_role = role
    service.checker = MagicMock()
    service.shift_repo = MagicMock()
    service.db = MagicMock()
    service.org_id = uuid4()
    return service


def _shift(**overrides):
    values = {
        "id": uuid4(),
        "worker_id": uuid4(),
        "client_id": uuid4(),
        "start_time": datetime(2026, 8, 10, 9, 0),
        "end_time": datetime(2026, 8, 10, 11, 0),
        "is_recurring": False,
        "recurrence_rule": None,
        "recurrence_end_date": None,
        "location": None,
        "notes": None,
        "overtime_approved": False,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_shared_enforcement_raises_consistent_conflict_error():
    service = _service()
    conflict = {
        "date": "2026-08-10",
        "start": "2026-08-10T10:00:00",
        "end": "2026-08-10T12:00:00",
        "client_name": "Another Client",
    }
    service.checker.find_conflicts.return_value = [conflict]

    with pytest.raises(AppError) as exc_info:
        service._enforce_scheduling_rules(
            worker_id=uuid4(),
            proposed_time_blocks=[(
                datetime(2026, 8, 10).date(),
                datetime(2026, 8, 10, 10, 0),
                datetime(2026, 8, 10, 12, 0),
            )],
        )

    assert exc_info.value.status_code == 409
    assert exc_info.value.code == "WORKER_ALREADY_SCHEDULED_AT_THIS_TIME_BLOCK"
    service.checker.find_hours_violations.assert_not_called()


def test_shared_enforcement_rejects_non_approver_override():
    service = _service(OrgMemberRole.supervisor)
    service.checker.find_conflicts.return_value = []

    with pytest.raises(AppError) as exc_info:
        service._enforce_scheduling_rules(
            worker_id=uuid4(),
            proposed_time_blocks=[(
                datetime(2026, 8, 10).date(),
                datetime(2026, 8, 10, 9, 0),
                datetime(2026, 8, 10, 11, 0),
            )],
            override_hours_check=True,
        )

    assert exc_info.value.status_code == 403
    assert exc_info.value.code == "OVERTIME_APPROVAL_REQUIRED"
    service.checker.find_hours_violations.assert_not_called()


def test_master_shift_time_edit_is_checked_and_excludes_itself():
    service = _service()
    shift = _shift()
    service.shift_repo.get_active_shift.return_value = shift
    service.checker.find_conflicts.return_value = [{
        "date": "2026-08-10",
        "start": "2026-08-10T10:00:00",
        "end": "2026-08-10T12:00:00",
        "client_name": "Another Client",
    }]

    with pytest.raises(AppError) as exc_info:
        asyncio.run(service.update_shift(
            str(shift.id),
            ShiftUpdateSchema(
                start_time=datetime(2026, 8, 10, 10, 0),
                end_time=datetime(2026, 8, 10, 12, 0),
            ),
        ))

    assert exc_info.value.code == "WORKER_ALREADY_SCHEDULED_AT_THIS_TIME_BLOCK"
    _, kwargs = service.checker.find_conflicts.call_args
    assert kwargs["exclude_shift_id"] == str(shift.id)
    service.db.commit.assert_not_called()


def test_master_shift_notes_only_edit_does_not_recheck_schedule():
    service = _service()
    shift = _shift()
    service.shift_repo.get_active_shift.return_value = shift

    asyncio.run(service.update_shift(
        str(shift.id),
        ShiftUpdateSchema(notes="Updated visit instructions"),
    ))

    assert shift.notes == "Updated visit instructions"
    service.checker.find_conflicts.assert_not_called()
    service.checker.find_hours_violations.assert_not_called()
    service.db.commit.assert_called_once()


def test_master_shift_manager_override_marks_overtime_approved():
    service = _service(OrgMemberRole.manager)
    shift = _shift()
    service.shift_repo.get_active_shift.return_value = shift
    service.checker.find_conflicts.return_value = []

    asyncio.run(service.update_shift(
        str(shift.id),
        ShiftUpdateSchema(
            end_time=datetime(2026, 8, 10, 13, 0),
            override_hours_check=True,
        ),
    ))

    assert shift.end_time == datetime(2026, 8, 10, 13, 0)
    assert shift.overtime_approved is True
    service.checker.find_hours_violations.assert_not_called()
    service.db.commit.assert_called_once()


def test_master_recurring_edit_checks_every_proposed_occurrence():
    service = _service()
    shift = _shift(
        is_recurring=True,
        recurrence_rule="FREQ=WEEKLY;BYDAY=MO",
        recurrence_end_date=date(2026, 8, 24),
    )
    service.shift_repo.get_active_shift.return_value = shift
    service.checker.find_conflicts.return_value = []
    service.checker.find_hours_violations.return_value = ([], [])

    asyncio.run(service.update_shift(
        str(shift.id),
        ShiftUpdateSchema(
            start_time=datetime(2026, 8, 10, 10, 0),
            end_time=datetime(2026, 8, 10, 12, 0),
        ),
    ))

    _, kwargs = service.checker.find_conflicts.call_args
    proposed = kwargs["proposed_time_blocks"]
    assert [block[0] for block in proposed] == [
        date(2026, 8, 10),
        date(2026, 8, 17),
        date(2026, 8, 24),
    ]
