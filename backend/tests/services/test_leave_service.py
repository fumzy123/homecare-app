"""Leave audit identity must reference agency employment, not Supabase Auth."""
from datetime import date
from types import SimpleNamespace
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session

from app.core.enums import OrgMemberRole
from app.core.exceptions import AppError
from app.models.organization import Organization
from app.models.person import Person
from app.models.employment import Employment
from app.models.leave_record import LeaveRecord
from app.schemas.leave_record import LeaveRecordCreateSchema, LeaveRecordResponse
from app.services.leave_service import LeaveService


@pytest.fixture
def agency():
    import os
    from sqlalchemy.engine import make_url
    url = os.getenv('LEAVE_TEST_DATABASE_URL', 'sqlite://')
    assert url == 'sqlite://' or make_url(url).database.endswith('_test')
    engine = create_engine(url)

    @event.listens_for(engine, 'connect')
    def enable_foreign_keys(connection, _):
        if url == 'sqlite://':
            connection.execute('PRAGMA foreign_keys=ON')

    from app.models.base import Base
    Base.metadata.create_all(engine)
    connection = engine.connect() if url != 'sqlite://' else None
    transaction = connection.begin() if connection else None
    with Session(bind=connection if connection is not None else engine, join_transaction_mode='create_savepoint') as db:
        auth_id = uuid4()
        org = Organization(name='Test agency', owner_id=auth_id)
        person = Person(first_name='Test', last_name='Admin', email='admin@example.test', supabase_user_id=auth_id)
        worker = Person(first_name='Test', last_name='Worker', email='worker@example.test')
        db.add_all([org, person, worker])
        db.flush()
        member = Employment(org_id=org.id, person_id=person.id, role=OrgMemberRole.owner)
        employee = Employment(org_id=org.id, person_id=worker.id, role=OrgMemberRole.home_support_worker)
        db.add_all([member, employee])
        db.commit()
        yield db, SimpleNamespace(id=auth_id), member, employee
    if transaction:
        transaction.rollback()
        connection.close()
    engine.dispose()


def payload():
    return LeaveRecordCreateSchema(leave_type='sick', start_date=date(2026, 12, 14),
                                  end_date=date(2026, 12, 14), notes='Test absence')


def test_leave_persists_with_employment_recorder_and_round_trips(agency):
    db, user, member, worker = agency
    service = LeaveService(db, user)
    record = service.create_leave_record(worker.id, payload())
    response = LeaveRecordResponse.model_validate(record)
    assert response.recorded_by == member.id
    assert response.recorded_by != user.id
    assert response.org_id == member.org_id
    assert response.notes == 'Test absence'
    db.expire_all()
    assert [r.id for r in service.list_leave_records(worker.id, 2026)] == [record.id]
    service.delete_leave_record(worker.id, record.id)
    assert service.list_leave_records(worker.id, 2026) == []


def test_leave_rejects_worker_from_another_agency(agency):
    db, user, _, worker = agency
    other = Organization(name='Other agency', owner_id=uuid4())
    db.add(other)
    db.flush()
    worker.org_id = other.id
    db.commit()
    with pytest.raises(AppError):
        LeaveService(db, user).create_leave_record(worker.id, payload())
    assert db.query(LeaveRecord).count() == 0


def test_leave_rejects_missing_membership(agency):
    db, _, _, _ = agency
    with pytest.raises(AppError):
        LeaveService(db, SimpleNamespace(id=uuid4()))


@pytest.fixture
def visits(agency, monkeypatch):
    from datetime import datetime, timedelta
    from app.models.client import Client
    from app.models.shift import Shift
    from app.services.worker_notification_service import WorkerNotificationService
    db, user, member, worker = agency
    monkeypatch.setattr(WorkerNotificationService, 'schedule', lambda *a, **k: None)
    client = Client(org_id=member.org_id, first_name='Test', last_name='Client', date_of_birth=date(1940, 1, 1),
        street='1 Test', city='Test', province='NL', postal_code='A1A1A1',
        emergency_contact_name='Test', emergency_contact_phone='555', emergency_contact_relationship='Family')
    db.add(client)
    db.flush()
    day = date.today() + timedelta(days=30)
    start = datetime.combine(day, datetime.min.time()).replace(hour=10)
    shift = Shift(org_id=member.org_id, worker_id=worker.id, client_id=client.id, created_by=member.id,
        start_time=start, end_time=start + timedelta(hours=2), is_recurring=True, recurrence_rule='FREQ=DAILY')
    db.add(shift)
    db.commit()
    request = LeaveRecordCreateSchema(leave_type='vacation', start_date=day, end_date=day)
    return db, user, member, worker, shift, request


def test_preview_confirmation_drops_only_affected_visit_and_removal_preserves_gap(visits):
    from datetime import timedelta
    from app.domain.scheduling import resolve_effective_occurrence, timeblock_for_occurrence
    db, user, member, worker, shift, request = visits
    service = LeaveService(db, user)
    review = service.review_leave(worker.id, request)
    assert len(review['visits']) == 1
    assert shift.modifications == []
    with pytest.raises(AppError):
        service.create_leave_record(worker.id, request)
    request.review_token = review['review_token']
    record = service.create_leave_record(worker.id, request)
    db.expire_all()
    mod = shift.modifications[0]
    assert mod.completion_status.value == 'dropped'
    assert 'Worker on leave' in mod.dropped_reason
    from app.services.attention_service import AttentionService
    alerts = AttentionService(db, user).list_items().items
    assert any(i.stage == 'replace_worker' and i.target.record_id == shift.id for i in alerts)
    assert timeblock_for_occurrence(shift, request.start_date, {mod.original_date: mod}) is None
    assert resolve_effective_occurrence(shift, request.start_date + timedelta(days=1), None).completion_status.value == 'scheduled'
    service.delete_leave_record(worker.id, record.id)
    assert mod.completion_status.value == 'dropped'


def test_stale_review_and_documented_visit_protection(visits):
    from datetime import timedelta
    from app.models.progress_note import ProgressNote
    db, user, _, worker, shift, request = visits
    service = LeaveService(db, user)
    request.review_token = service.review_leave(worker.id, request)['review_token']
    shift.start_time += timedelta(minutes=30)
    db.commit()
    with pytest.raises(AppError):
        service.create_leave_record(worker.id, request)
    db.add(ProgressNote(shift_id=shift.id, occurrence_date=request.start_date, entries=[{'content': 'Retain me'}]))
    db.commit()
    review = service.review_leave(worker.id, request)
    assert review['visits'] == []
    assert review['protected_count'] == 1
    request.review_token = review['review_token']
    service.create_leave_record(worker.id, request)
    assert shift.modifications == []


def test_cover_preserves_original_recurring_worker_and_blocks_double_approval(visits, monkeypatch):
    import asyncio
    from app.services.shift_service import ShiftService
    from app.services.billing_cutoff_service import BillingCutoffService
    from app.schemas.shift import ShiftReplacementSchema
    from app.models.shift import Shift
    db, user, member, worker, shift, request = visits
    monkeypatch.setattr(BillingCutoffService, 'seal_due', lambda *a, **k: None)
    person = Person(first_name='Cover', last_name='Worker', email='cover@example.test')
    db.add(person)
    db.flush()
    cover = Employment(person_id=person.id, org_id=member.org_id, role=OrgMemberRole.home_support_worker, max_hours_per_week=40)
    db.add(cover)
    db.commit()
    service = LeaveService(db, user)
    request.review_token = service.review_leave(worker.id, request)['review_token']
    service.create_leave_record(worker.id, request)
    args = ShiftReplacementSchema(worker_id=cover.id, confirm_arranged=True)
    result = asyncio.run(ShiftService(db, user).replace_dropped_visit(shift.id, request.start_date, args))
    db.expire_all()
    mod = shift.modifications[0]
    assert str(mod.replacement_shift_id) == result['replacement_shift_id']
    replacement = db.get(Shift, mod.replacement_shift_id)
    assert replacement.worker_id == cover.id
    assert not replacement.is_recurring
    assert shift.worker_id == worker.id and shift.is_recurring
    assert mod.completion_status.value == 'cancelled'
    from app.repositories.shift_repository import ShiftRepository
    repo = ShiftRepository(db)
    assert repo.replacement_origins(uuid4(), [replacement.id]) == {}
    origins = repo.replacement_origins(member.org_id, [replacement.id])
    response = ShiftService._build_occurrence_response(replacement, replacement.start_time.date(), None, origins[replacement.id])
    assert response.replacement_for.worker.id == worker.id
    assert response.replacement_for.reason == 'On leave'
    original = ShiftService._build_occurrence_response(shift, request.start_date, mod)
    assert original.absence_kind == 'recorded_leave'
    # Read projection works when filtering to the replacement worker only.
    listed = asyncio.run(ShiftService(db, user).get_shifts(request.start_date, request.end_date, worker_id=cover.id))
    assert len(listed) == 1 and listed[0].replacement_for.worker.id == worker.id

    with pytest.raises(AppError):
        asyncio.run(ShiftService(db, user).replace_dropped_visit(shift.id, request.start_date, args))
    assert db.query(Shift).count() == 2


def test_leave_blocks_scheduling_and_replacement_with_absent_worker(visits, monkeypatch):
    import asyncio
    from app.domain.scheduling import SchedulingChecker
    from app.services.shift_service import ShiftService
    from app.services.billing_cutoff_service import BillingCutoffService
    from app.schemas.shift import ShiftReplacementSchema
    db, user, _, worker, shift, request = visits
    monkeypatch.setattr(BillingCutoffService, 'seal_due', lambda *a, **k: None)
    service = LeaveService(db, user)
    request.review_token = service.review_leave(worker.id, request)['review_token']
    service.create_leave_record(worker.id, request)
    assert SchedulingChecker(db, worker.org_id).find_conflicts(worker.id, [(request.start_date, shift.start_time, shift.end_time)])
    with pytest.raises(AppError):
        asyncio.run(ShiftService(db, user).replace_dropped_visit(shift.id, request.start_date,
            ShiftReplacementSchema(worker_id=worker.id, confirm_arranged=True)))
    db.expire_all()
    assert shift.modifications[0].completion_status.value == 'dropped'


def test_overnight_and_moved_visits_use_effective_interval(visits):
    from datetime import timedelta
    from app.models.shift_modification import ShiftModification
    db, user, _, worker, shift, request = visits
    shift.is_recurring = False
    shift.start_time = shift.start_time.replace(hour=23) - timedelta(days=1)
    shift.end_time = shift.start_time + timedelta(hours=3)
    db.commit()
    service = LeaveService(db, user)
    assert len(service.review_leave(worker.id, request)['visits']) == 1
    db.add(ShiftModification(shift_id=shift.id, original_date=shift.start_time.date(),
        new_start_time=shift.start_time - timedelta(days=3), new_end_time=shift.end_time - timedelta(days=3)))
    db.commit()
    assert service.review_leave(worker.id, request)['visits'] == []


def test_replacement_availability_includes_all_agency_workers_and_deduplicates(visits):
    from app.services.shift_service import ShiftService
    db, user, member, worker, shift, request = visits
    another_person = Person(first_name='Another', last_name='Worker', email='another@example.test')
    db.add(another_person)
    db.flush()
    another = Employment(org_id=member.org_id, person_id=another_person.id, role=OrgMemberRole.home_support_worker)
    other_org = Organization(name='Other', owner_id=uuid4())
    db.add_all([another, other_org])
    db.flush()
    for worker_id, org_id in [(worker.id, member.org_id), (another.id, member.org_id), (another.id, member.org_id), (member.id, other_org.id)]:
        db.add(LeaveRecord(worker_id=worker_id, org_id=org_id, recorded_by=member.id, leave_type='vacation', start_date=request.start_date, end_date=request.end_date))
    db.commit()
    result = ShiftService(db, user).replacement_availability(shift.id, request.start_date)
    assert set(result.on_leave_worker_ids) == {worker.id, another.id}
    assert len(result.on_leave_worker_ids) == 2
    with pytest.raises(AppError):
        ShiftService(db, user).replacement_availability(uuid4(), request.start_date)
    shift.org_id = other_org.id
    db.commit()
    with pytest.raises(AppError):
        ShiftService(db, user).replacement_availability(shift.id, request.start_date)


def test_replacement_availability_uses_moved_interval_and_midnight_boundary(visits):
    from datetime import datetime, timedelta
    from app.models.shift_modification import ShiftModification
    from app.services.shift_service import ShiftService
    db, user, member, worker, shift, request = visits
    # A cross-year leave covers Jan 1, even though it starts in December.
    db.add(LeaveRecord(worker_id=worker.id, org_id=member.org_id, recorded_by=member.id,
                       leave_type='vacation', start_date=date(2027, 12, 31), end_date=date(2028, 1, 1)))
    mod = ShiftModification(shift_id=shift.id, original_date=request.start_date,
                            new_start_time=datetime(2027, 12, 30, 22), new_end_time=datetime(2027, 12, 31),
                            completion_status='dropped')
    db.add(mod)
    db.commit()
    db.expire_all()
    service = ShiftService(db, user)
    assert service.replacement_availability(shift.id, request.start_date).on_leave_worker_ids == []
    mod.new_end_time += timedelta(minutes=1)
    db.commit()
    assert service.replacement_availability(shift.id, request.start_date).on_leave_worker_ids == [worker.id]
    mod.new_start_time = datetime(2028, 1, 1, 10)
    mod.new_end_time = datetime(2028, 1, 1, 12)
    db.commit()
    assert service.replacement_availability(shift.id, request.start_date).on_leave_worker_ids == [worker.id]
