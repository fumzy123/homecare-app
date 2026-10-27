import asyncio
from datetime import date, datetime
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.enums import ShiftCompletionStatus, ShiftStatus
from app.domain.scheduling import calendar_occurrence_dates, resolve_effective_occurrence
from app.models.client import Client
from app.models.employment import Employment
from app.models.person import Person
from app.models.shift import Shift
from app.models.shift_modification import ShiftModification
from app.repositories.shift_repository import ShiftRepository
from app.services.shift_service import ShiftService


def shift(**changes):
    return SimpleNamespace(**(dict(
        id=uuid4(), start_time=datetime(2026, 10, 19, 9), end_time=datetime(2026, 10, 19, 11),
        is_recurring=True, recurrence_rule='FREQ=WEEKLY;BYDAY=MO', recurrence_end_date=None,
        modifications=[], location='Example', notes='Instructions',
    ) | changes))


def modification(day, start, end=None, status=ShiftCompletionStatus.scheduled):
    return SimpleNamespace(id=uuid4(), original_date=date.fromisoformat(day),
        new_start_time=datetime.fromisoformat(start) if start else None,
        new_end_time=datetime.fromisoformat(end) if end else None, completion_status=status, notes=None)


def test_calendar_includes_moves_from_both_directions_and_excludes_moves_out():
    value = shift(modifications=[
        modification('2026-10-19', '2026-10-27T09:00:00'),
        modification('2026-10-26', '2026-11-03T09:00:00'),
        modification('2026-11-02', '2026-10-30T09:00:00'),
    ])
    assert calendar_occurrence_dates(value, date(2026, 10, 25), date(2026, 10, 31)) == [date(2026, 10, 19), date(2026, 11, 2)]


def test_calendar_includes_overnight_carry_in_but_not_midnight_end_or_truncated_overrides():
    value = shift(start_time=datetime(2026, 10, 24, 22), end_time=datetime(2026, 10, 25, 2),
                  recurrence_rule='FREQ=WEEKLY;BYDAY=SA', recurrence_end_date=date(2026, 10, 24),
                  modifications=[modification('2026-10-31', '2026-10-26T09:00:00')])
    assert calendar_occurrence_dates(value, date(2026, 10, 25), date(2026, 10, 31)) == [date(2026, 10, 24)]
    value.end_time = datetime(2026, 10, 25)
    assert calendar_occurrence_dates(value, date(2026, 10, 25), date(2026, 10, 31)) == []


def test_calendar_handles_one_off_and_end_only_override():
    value = shift(is_recurring=False, modifications=[modification('2026-10-19', '2026-10-27T09:00:00')])
    assert calendar_occurrence_dates(value, date(2026, 10, 25), date(2026, 10, 31)) == [date(2026, 10, 19)]
    value.modifications = [modification('2026-10-19', None, '2026-10-25T02:00:00')]
    assert calendar_occurrence_dates(value, date(2026, 10, 25), date(2026, 10, 31)) == [date(2026, 10, 19)]


def test_service_calendar_opt_in_preserves_original_lookup_and_status_filters():
    value = shift(modifications=[modification('2026-10-19', '2026-10-27T09:00:00', status=ShiftCompletionStatus.cancelled)])
    svc = ShiftService.__new__(ShiftService)
    svc.shift_repo, svc.org_id = MagicMock(), uuid4()
    svc.shift_repo.get_shifts_in_range.return_value = [value]
    svc._build_occurrence_response = lambda s, day, mod: SimpleNamespace(
        date=day, start_time=resolve_effective_occurrence(s, day, mod).start_time)
    result = asyncio.run(svc.get_shifts(date(2026, 10, 25), date(2026, 10, 31), 'worker', 'client', ['cancelled'], calendar_window=True))
    assert [r.date for r in result] == [date(2026, 10, 19)]
    svc.shift_repo.get_shifts_in_range.assert_called_with(svc.org_id, date(2026, 10, 31), 'worker', 'client', include_rescheduled=True)
    original = asyncio.run(svc.get_shifts(date(2026, 10, 19), date(2026, 10, 19), completion_statuses=['cancelled']))
    assert original[0].date == date(2026, 10, 19)
    assert original[0].start_time == datetime(2026, 10, 27, 9)
    assert asyncio.run(svc.get_shifts(date(2026, 10, 25), date(2026, 10, 31), completion_statuses=['dropped'], calendar_window=True)) == []


def test_repository_includes_future_master_moved_in_with_tenant_and_filter_isolation():
    engine = create_engine('sqlite://')
    for model in (Person, Employment, Client, Shift, ShiftModification):
        model.__table__.create(engine)
    org, worker, client = uuid4(), uuid4(), uuid4()
    with Session(engine) as db:
        def add(**changes):
            value = Shift(**(dict(org_id=org, worker_id=worker, client_id=client, created_by=worker,
                                 start_time=datetime(2026, 11, 2, 9), end_time=datetime(2026, 11, 2, 11)) | changes))
            db.add(value)
            db.flush()
            db.add(ShiftModification(shift_id=value.id, original_date=date(2026, 11, 2),
                                    new_start_time=datetime(2026, 10, 26, 9)))
            return value
        expected = add()
        add(org_id=uuid4())
        add(worker_id=uuid4())
        add(client_id=uuid4())
        add(deleted_at=datetime(2026, 10, 25))
        add(status=ShiftStatus.cancelled)
        db.commit()
        repo = ShiftRepository(db)
        assert repo.get_shifts_in_range(org, date(2026, 10, 31), worker, client) == []
        assert [s.id for s in repo.get_shifts_in_range(org, date(2026, 10, 31), worker, client, include_rescheduled=True)] == [expected.id]
    engine.dispose()
