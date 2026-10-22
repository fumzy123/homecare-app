"""Retirement preserves records and supports approval of unclassified care slots."""
import importlib.util
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import inspect, text

from app.models.weekly_care_need import CareSlot
from app.models.shift import Shift
from tests.integration.test_care_coverage import scenario, direct_payload  # noqa: F401


def test_retirement_migration_preserves_history_and_allows_unclassified_slots(scenario):  # noqa: F811
    s = scenario
    connection = s.db.connection()
    # Recreate the old constraint within this rollback-only test database transaction.
    connection.execute(text("UPDATE care_slots SET service_type = 'nursing' WHERE service_type IS NULL"))
    connection.execute(text('ALTER TABLE care_slots ALTER COLUMN service_type SET NOT NULL'))
    before = connection.execute(text('SELECT id, weekly_care_need_id, day_of_week, start_time, end_time, service_type FROM care_slots ORDER BY id')).all()
    shifts = connection.execute(text('SELECT id, start_time, end_time, recurrence_rule, recurrence_end_date, notes FROM shifts ORDER BY id')).all()
    snapshots = connection.execute(text('SELECT id, care_slot_snapshot, shift_description FROM placements ORDER BY id')).all()
    path = Path(__file__).parents[2] / 'alembic/versions/6783506efc77_retire_service_type_requirement_.py'
    spec = importlib.util.spec_from_file_location('retire_service_type', path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    with Operations.context(MigrationContext.configure(connection)):
        migration.upgrade()
    assert connection.execute(text('SELECT id, weekly_care_need_id, day_of_week, start_time, end_time, service_type FROM care_slots ORDER BY id')).all() == before
    assert connection.execute(text('SELECT id, start_time, end_time, recurrence_rule, recurrence_end_date, notes FROM shifts ORDER BY id')).all() == shifts
    assert connection.execute(text('SELECT id, care_slot_snapshot, shift_description FROM placements ORDER BY id')).all() == snapshots
    assert next(c for c in inspect(connection).get_columns('care_slots') if c['name'] == 'service_type')['nullable']
    existing = s.need.care_slots[0]
    unclassified = CareSlot(client_id=s.client.id, weekly_care_need_id=s.need.id,
        day_of_week=existing.day_of_week, start_time=existing.start_time, end_time=existing.end_time)
    s.db.add(unclassified)
    s.db.flush()
    assert unclassified.service_type is None


def test_unclassified_slots_can_be_reviewed_and_scheduled(scenario):  # noqa: F811
    s = scenario
    payload = direct_payload(s)
    for slot in s.need.care_slots:
        slot.service_type = None
    placement = s.service.placement_repo.get_by_id(s.placement.id)
    placement.care_slot_snapshot = [
        {key: value for key, value in slot.items() if key != 'service_type'}
        for slot in placement.care_slot_snapshot
    ]
    s.db.commit()
    review = s.service.review_approval(s.placement.id, payload)
    assert review['all_clear']
    payload.review_token = review['review_token']
    result = s.service.approve_coverage(s.placement.id, payload)
    assert result.covered_count == 2
    assert all('service_type' not in slot for slot in result.care_slots)
    visits = s.db.query(Shift).filter(Shift.weekly_care_need_id == s.need.id).all()
    assert len(visits) == 2
    assert all(visit.service_type is None for visit in visits)
