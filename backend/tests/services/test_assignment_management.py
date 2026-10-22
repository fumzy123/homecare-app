"""Real SQLAlchemy transactions over fictional isolated SQLite records.

SQLite does not verify PostgreSQL row-lock behavior; the migration needs staging verification.
"""
from datetime import date, datetime, time, timedelta, timezone
from types import SimpleNamespace as NS
from unittest.mock import MagicMock
from uuid import uuid4
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.models.organization import Organization
from app.models.person import Person
from app.models.employment import Employment
from app.models.client import Client
from app.models.weekly_care_need import WeeklyCareNeed, CareSlot
from app.models.placement import Placement, PlacementInterest, CareSlotAssignment
from app.models.shift import Shift
from app.models.shift_modification import ShiftModification
from app.models.progress_note import ProgressNote
from app.models.activity import ActivityEvent
from app.core.enums import OrgMemberRole, WeekDay, ServiceType, PlacementStatus, ShiftCompletionStatus
from app.core.exceptions import AppError
from app.schemas.assignment import EndAssignments
from app.schemas.placement import PlacementApproval
from app.services.assignment_service import AssignmentService
from app.services.placement_service import PlacementService
from app.services.shift_service import ShiftService
from app.repositories.attention_repository import AttentionRepository
from app.domain.attention import coverage_item
from app.domain.scheduling import expand_occurrences


@pytest.fixture
def case(monkeypatch):
    engine = create_engine('sqlite://')
    for model in [Organization, Person, Employment, Client, WeeklyCareNeed, CareSlot, Placement,
                  PlacementInterest, CareSlotAssignment, Shift, ShiftModification, ProgressNote, ActivityEvent]:
        model.__table__.create(engine)
    clock = NS(now=datetime(2090, 10, 9, 12))
    monkeypatch.setattr(AssignmentService, '_now', lambda self, org: clock.now)
    monkeypatch.setattr('app.services.assignment_service.BillingEvidenceService', lambda *a: MagicMock())
    notices = MagicMock()
    monkeypatch.setattr('app.services.assignment_service.WorkerNotificationService', lambda *a: notices)
    monkeypatch.setattr('app.services.placement_service.NotificationService', lambda *a: MagicMock())
    with Session(engine) as db:
        def add(model, **kw):
            row = model(**kw)
            db.add(row)
            db.flush()
            return row
        user = NS(id=uuid4())
        org = add(Organization, name='Fictional agency', owner_id=user.id, billing_timezone='America/St_Johns')
        people = [add(Person, first_name=n, last_name='Example', email=f'{uuid4()}@example.test',
                      supabase_user_id=user.id if i == 0 else uuid4()) for i, n in enumerate(['Admin', 'Blue', 'Replacement'])]
        members = [add(Employment, person_id=p.id, org_id=org.id, role=OrgMemberRole.owner if i == 0 else OrgMemberRole.home_support_worker)
                   for i, p in enumerate(people)]
        client = add(Client, org_id=org.id, first_name='Margaret', last_name='Example', date_of_birth=date(1940, 1, 1),
                     street='1 Example', city='Example', province='NL', postal_code='A1A1A1', emergency_contact_name='Contact',
                     emergency_contact_phone='555', emergency_contact_relationship='Family')
        need = add(WeeklyCareNeed, org_id=org.id, client_id=client.id, version=1, effective_from=date(2090, 9, 1),
                   scheduled_from=date(2090, 9, 1), activated_at=datetime.now(timezone.utc))
        slots = [add(CareSlot, weekly_care_need_id=need.id, client_id=client.id, day_of_week=day, start_time=time(9),
                     end_time=time(11), service_type=ServiceType.personal_care) for day in [WeekDay.MO, WeekDay.WE, WeekDay.FR]]
        placement = add(Placement, org_id=org.id, client_id=client.id, weekly_care_need_id=need.id, created_by=members[0].id,
                        shift_description='Weekly care', masked_location='Example', status=PlacementStatus.filled,
                        care_slot_snapshot=[{'id': str(s.id), 'day_of_week': s.day_of_week.value, 'start_time': '09:00',
                                             'end_time': '11:00', 'service_type': 'personal_care'} for s in slots])
        assignments, shifts = [], []
        for slot in slots:
            a = add(CareSlotAssignment, care_slot_id=slot.id, placement_id=placement.id, employment_id=members[1].id,
                    approved_by=members[0].id, starts_on=date(2090, 9, 1))
            assignments.append(a)
            shifts.append(add(Shift, org_id=org.id, client_id=client.id, worker_id=members[1].id, created_by=members[0].id,
                              weekly_care_need_id=need.id, care_slot_id=slot.id, assignment_id=a.id, is_recurring=True,
                              recurrence_rule=f'FREQ=WEEKLY;BYDAY={slot.day_of_week.value}', start_time=datetime(2090, 9, 1, 9), end_time=datetime(2090, 9, 1, 11)))
        past = expand_occurrences(shifts[2], date(2090, 9, 1), date(2090, 9, 7))[0]
        note = add(ProgressNote, shift_id=shifts[2].id, occurrence_date=past, entries=[{'time': '10:00', 'content': 'Original care note'}])
        db.commit()
        service = AssignmentService(db, user, org.id)
        service.cutoff_service = MagicMock()
        payload = EndAssignments(assignment_ids=[assignments[2].id], stops_from=date(2090, 10, 20), reason='Reassigned to another client')
        yield NS(db=db, add=add, org=org, user=user, members=members, client=client, need=need, placement=placement,
                 slots=slots, assignments=assignments, shifts=shifts, note=note, service=service, payload=payload, clock=clock, notices=notices)
    engine.dispose()


def confirm(c):
    c.payload.review_token = c.service.review_end(c.payload)['review_token']
    return c.service.end_assignments(c.payload)


def test_partial_ending_retains_history_and_reopens_existing_request(case):
    c = case
    prior = expand_occurrences(c.shifts[2], date(2090, 9, 1), date(2090, 10, 19))
    review = c.service.review_end(c.payload)
    assert review['series_count'] == 1
    assert c.assignments[2].ends_before is None and c.shifts[2].recurrence_end_date is None
    result = confirm(c)
    assert result['placement_id'] == str(c.placement.id)
    assert c.shifts[2].recurrence_end_date == date(2090, 10, 19)
    assert all(s.recurrence_end_date is None for s in c.shifts[:2])
    assert expand_occurrences(c.shifts[2], date(2090, 9, 1), date(2090, 10, 19)) == prior
    assert not expand_occurrences(c.shifts[2], date(2090, 10, 20), date(2091, 1, 1))
    assert c.note.entries == [{'time': '10:00', 'content': 'Original care note'}]
    assert c.db.query(CareSlotAssignment).count() == 3 and c.need.ends_on is None
    assert c.placement.status == PlacementStatus.open
    assert c.assignments[2].ended_by == c.members[0].id and c.assignments[2].end_reason == c.payload.reason
    assert c.members[1].employment_status.value == 'active'
    c.notices.schedule.assert_called_once()
    assert c.db.query(ActivityEvent).count() == 1
    repo = AttentionRepository(c.db)
    covered = {slot for _, slot in repo.assignments(c.org.id, [c.placement.id])}
    endings = {slot: stop for _, slot, stop in repo.assignment_endings(c.org.id, [c.placement.id])}
    action = coverage_item(c.need, c.client, c.placement, covered, c.clock.now.date(), endings)
    assert 'Replacement needed' in action.detail and action.due_on >= c.payload.stops_from
    assert action.id == f'care:{c.need.id}'


def test_replacement_has_new_assignment_and_keeps_original_author(case):
    c = case
    confirm(c)
    p = PlacementService(c.db, c.user, c.org.id)
    p.cutoff_service = MagicMock()
    p._validate_selected_coverage = MagicMock(return_value=[{'worker_id': str(c.members[2].id), 'worker_name': 'Replacement', 'eligibility': {'all_clear': True}}])
    c.add(PlacementInterest, placement_id=c.placement.id, employment_id=c.members[2].id, care_slot_ids=[str(c.slots[2].id)])
    c.db.commit()
    payload = PlacementApproval(selections=[{'care_slot_id': c.slots[2].id, 'employment_id': c.members[2].id}], starts_on=c.payload.stops_from)
    payload.review_token = p.review_approval(c.placement.id, payload)['review_token']
    result = p.approve_coverage(c.placement.id, payload)
    assert result.covered_count == 3
    assert c.db.query(CareSlotAssignment).filter_by(care_slot_id=c.slots[2].id).count() == 2
    assert c.shifts[2].worker_id == c.members[1].id
    new_shift = c.db.query(Shift).filter(Shift.worker_id == c.members[2].id).one()
    assert new_shift.assignment_id != c.assignments[2].id and new_shift.start_time.date() >= c.payload.stops_from
    assert c.note.entries[0]['content'] == 'Original care note'
    p._validate_selected_coverage.assert_called()


def test_replacement_cannot_overlap_existing_coverage(case):
    c = case
    confirm(c)
    p = PlacementService(c.db, c.user, c.org.id)
    payload = PlacementApproval(selections=[{'care_slot_id': c.slots[2].id, 'employment_id': c.members[2].id}], starts_on=c.payload.stops_from - timedelta(days=1))
    with pytest.raises(AppError) as error:
        p.review_approval(c.placement.id, payload)
    assert error.value.code == 'ASSIGNMENT_OVERLAP'


def test_late_replacement_cannot_silently_hide_interim_unmet_care(case):
    c = case
    confirm(c)
    p = PlacementService(c.db, c.user, c.org.id)
    payload = PlacementApproval(selections=[{'care_slot_id': c.slots[2].id, 'employment_id': c.members[2].id}],
                                starts_on=c.payload.stops_from + timedelta(days=14))
    with pytest.raises(AppError) as error:
        p.review_approval(c.placement.id, payload)
    assert error.value.code == 'REPLACEMENT_COVERAGE_GAP'
    assert c.placement.status == PlacementStatus.open


def test_stale_review_repeat_and_cross_agency_are_rejected(case):
    c = case
    c.payload.review_token = c.service.review_end(c.payload)['review_token']
    c.shifts[2].end_time = datetime(2090, 9, 1, 12)
    c.db.commit()
    with pytest.raises(AppError) as error:
        c.service.end_assignments(c.payload)
    assert error.value.code == 'ASSIGNMENT_REVIEW_REQUIRED'
    assert c.assignments[2].ends_before is None
    confirm(c)
    with pytest.raises(AppError) as error:
        c.service.end_assignments(c.payload)
    assert error.value.code == 'ASSIGNMENT_CHANGED'
    c.service.org_id = uuid4()
    assert c.service.assignment_repo.list(c.service.org_id, worker_id=c.members[1].id) == []
    c.service.org_repo.lock_by_id = MagicMock(return_value=c.org)
    with pytest.raises(AppError) as error:
        c.service.review_end(c.payload)
    assert error.value.status_code == 404


@pytest.mark.parametrize('record', ['completed', 'in_progress', 'note', 'moved_past', 'moved_note'])
def test_documented_and_moved_past_visits_cannot_be_hidden(case, record):
    c = case
    future = expand_occurrences(c.shifts[2], c.payload.stops_from, c.payload.stops_from + timedelta(days=7))[0]
    if record == 'note':
        c.add(ProgressNote, shift_id=c.shifts[2].id, occurrence_date=future, entries=[{'content': 'Recorded'}])
    elif record == 'moved_note':
        c.add(ShiftModification, shift_id=c.shifts[2].id, original_date=c.note.occurrence_date, new_start_time=datetime.combine(future, time(9)))
    else:
        c.add(ShiftModification, shift_id=c.shifts[2].id, original_date=future,
              new_start_time=datetime(2090, 10, 8, 9) if record == 'moved_past' else None,
              completion_status=ShiftCompletionStatus.scheduled if record == 'moved_past' else ShiftCompletionStatus(record))
    c.db.commit()
    with pytest.raises(AppError):
        c.service.review_end(c.payload)
    assert c.shifts[2].recurrence_end_date is None


def test_rescheduled_future_visit_is_cancelled_without_deleting_record(case):
    c = case
    before = expand_occurrences(c.shifts[2], date(2090, 10, 10), date(2090, 10, 19))[0]
    mod = c.add(ShiftModification, shift_id=c.shifts[2].id, original_date=before,
                new_start_time=datetime(2090, 10, 25, 14), new_end_time=datetime(2090, 10, 25, 16))
    c.db.commit()
    confirm(c)
    assert mod.completion_status == ShiftCompletionStatus.cancelled
    assert mod.original_date == before and c.db.query(ShiftModification).count() == 1


def test_same_day_elapsed_visit_and_backdating_rejected(case):
    c = case
    day = expand_occurrences(c.shifts[2], date(2090, 10, 9), date(2090, 10, 16))[0]
    c.clock.now = datetime.combine(day, time(10))
    c.payload.stops_from = day
    with pytest.raises(AppError) as error:
        c.service.review_end(c.payload)
    assert error.value.code == 'RECORDED_VISIT_AT_CUTOFF'
    c.payload.stops_from = day - timedelta(days=1)
    with pytest.raises(AppError) as error:
        c.service.review_end(c.payload)
    assert error.value.code == 'PAST_STOP_DATE'


def test_shift_edit_cannot_restart_ended_assignment(case):
    c = case
    confirm(c)
    service = ShiftService.__new__(ShiftService)
    with pytest.raises(AppError) as error:
        service._check_coverage_bounds(c.shifts[2], c.shifts[2].start_time, None, True)
    assert error.value.code == 'ASSIGNMENT_ENDED'
    with pytest.raises(AppError) as error:
        service._check_coverage_bounds(c.shifts[2], c.shifts[2].start_time, None, True, worker_id=c.members[2].id)
    assert error.value.code == 'MANAGE_ASSIGNMENT_REQUIRED'


def test_unique_open_assignment_constraint_allows_history_only(case):
    c = case
    with pytest.raises(IntegrityError):
        c.add(CareSlotAssignment, care_slot_id=c.slots[2].id, placement_id=c.placement.id, employment_id=c.members[2].id,
              approved_by=c.members[0].id, starts_on=date(2090, 10, 20))
    c.db.rollback()
    assert c.db.query(CareSlotAssignment).count() == 3


@pytest.mark.parametrize('action', ['cancel_shift', 'cancel_from_date'])
def test_old_series_cancellation_cannot_bypass_assignment_workflow(case, action):
    import asyncio
    from app.schemas.shift import ShiftCancelSchema, ShiftCancelFromSchema
    c = case
    service = ShiftService(c.db, c.user)
    service.cutoff_service = MagicMock()
    payload = ShiftCancelSchema() if action == 'cancel_shift' else ShiftCancelFromSchema(occurrence_date=c.payload.stops_from)
    with pytest.raises(AppError) as error:
        asyncio.run(getattr(service, action)(c.shifts[2].id, payload))
    assert error.value.code == 'MANAGE_ASSIGNMENT_REQUIRED'
    assert c.shifts[2].deleted_at is None and c.assignments[2].ends_before is None
