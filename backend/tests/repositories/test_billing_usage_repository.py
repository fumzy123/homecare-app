from datetime import date, datetime, timedelta, timezone
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session

from app.core.enums import ShiftCompletionStatus, ShiftStatus
from app.domain.billing_usage import UsageWindow, active_clients
from app.models.shift import Shift
from app.models.shift_modification import ShiftModification
from app.models.client import Client
from app.repositories.billing_usage_repository import BillingUsageRepository


@pytest.fixture
def db():
    # Execute the real SQLAlchemy query locally. No Supabase data is touched.
    engine = create_engine("sqlite://")
    Shift.__table__.create(engine)
    ShiftModification.__table__.create(engine)
    Client.__table__.create(engine)
    with Session(engine) as session:
        yield session
    engine.dispose()


def add_shift(db, org, start, *, status=ShiftStatus.active, recurring=False, end=None, deleted=False):
    row = Shift(id=uuid4(), org_id=org, client_id=uuid4(), worker_id=uuid4(), created_by=uuid4(),
                start_time=start, end_time=start + timedelta(hours=2), status=status,
                is_recurring=recurring, recurrence_rule="FREQ=DAILY" if recurring else None,
                recurrence_end_date=end, deleted_at=datetime.now(timezone.utc) if deleted else None)
    db.add(row)
    return row


def add_mod(db, shift, day, *, status=ShiftCompletionStatus.scheduled, moved=None):
    db.add(ShiftModification(id=uuid4(), shift_id=shift.id, original_date=day,
                             completion_status=status, new_start_time=moved))


def window():
    return UsageWindow(datetime(2026, 9, 1, tzinfo=timezone.utc), datetime(2026, 10, 1, tzinfo=timezone.utc), "UTC")


def test_real_query_is_tenant_scoped_and_includes_moved_in_and_preserved_history(db):
    org = uuid4()
    ordinary = add_shift(db, org, datetime(2026, 9, 10, 9))
    future = add_shift(db, org, datetime(2026, 11, 10, 9))
    add_mod(db, future, date(2026, 11, 10), moved=datetime(2026, 9, 15, 9))
    expired = add_shift(db, org, datetime(2026, 1, 1, 9), recurring=True, end=date(2026, 1, 2))
    add_mod(db, expired, date(2026, 1, 2), moved=datetime(2026, 9, 18, 9))
    history = add_shift(db, org, datetime(2026, 9, 5, 9), status=ShiftStatus.cancelled, deleted=True)
    add_mod(db, history, date(2026, 9, 5), status=ShiftCompletionStatus.completed)
    add_shift(db, uuid4(), datetime(2026, 9, 1, 9))  # Other agency.
    add_shift(db, org, datetime(2026, 8, 1, 9))
    add_shift(db, org, datetime(2026, 8, 1, 9), recurring=True, end=date(2026, 8, 31))
    add_shift(db, org, datetime(2026, 9, 1, 9), status=ShiftStatus.cancelled)
    db.commit()
    expected = {s.id for s in (ordinary, future, expired, history)}
    db.expunge_all()
    statements = []
    event.listen(db.bind, "before_cursor_execute", lambda *_args: statements.append(_args[2]))
    candidates = BillingUsageRepository(db).candidates(org, window())
    assert {c.shift.id for c in candidates} == expected
    assert len(active_clients(candidates, window())) == 4
    assert len(statements) == 1  # Includes occurrence resolution: no lazy-load N+1.


def test_modifications_are_bounded_without_mutating_loaded_relationship(db):
    org = uuid4()
    series = add_shift(db, org, datetime(2026, 1, 1, 9), recurring=True)
    add_mod(db, series, date(2026, 1, 1))  # Outside range and not moved in.
    add_mod(db, series, date(2026, 9, 1), status=ShiftCompletionStatus.cancelled)
    add_mod(db, series, date(2026, 11, 1), moved=datetime(2026, 9, 18))
    db.commit()
    assert len(series.modifications) == 3
    candidate, = BillingUsageRepository(db).candidates(org, window())
    assert {m.original_date for m in candidate.modifications} == {date(2026, 9, 1), date(2026, 11, 1)}
    assert len(series.modifications) == 3


def test_moved_out_override_loaded_so_original_does_not_count(db):
    org = uuid4()
    row = add_shift(db, org, datetime(2026, 9, 1))
    add_mod(db, row, date(2026, 9, 1), moved=datetime(2026, 10, 5))
    db.commit()
    candidates = BillingUsageRepository(db).candidates(org, window())
    assert len(candidates) == 1
    assert active_clients(candidates, window()) == ()


def test_display_labels_include_archived_clients_but_never_other_agencies(db):
    org, archived_id, foreign_id = uuid4(), uuid4(), uuid4()
    for client_id, tenant, archived in ((archived_id, org, True), (foreign_id, uuid4(), False)):
        db.add(Client(id=client_id, org_id=tenant, first_name="Test", last_name="Client", date_of_birth=date(1950, 1, 1),
                      street="Private", city="Private", province="NL", postal_code="A1A1A1",
                      emergency_contact_name="Private", emergency_contact_phone="Private", emergency_contact_relationship="Private",
                      medical_conditions="Never returned in billing", deleted_at=datetime.now(timezone.utc) if archived else None))
    db.commit()
    labels = BillingUsageRepository(db).client_labels(org, [archived_id, foreign_id])
    assert labels == {archived_id: {"client_name": "Test Client", "client_archived": True}}


def test_empty_label_lookup_does_not_query(db):
    statements = []
    event.listen(db.bind, "before_cursor_execute", lambda *_args: statements.append(_args[2]))
    assert BillingUsageRepository(db).client_labels(uuid4(), []) == {}
    assert statements == []
