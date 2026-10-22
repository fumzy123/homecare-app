"""Real PostgreSQL transaction tests. Set CARE_TEST_DATABASE_URL to an isolated *_test database."""

import os
from datetime import date, datetime, time, timedelta, timezone
from types import SimpleNamespace as NS
from uuid import uuid4
from unittest.mock import MagicMock
import pytest
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session
import app.models  # noqa: F401 — register all relationships
from app.models.organization import Organization
from app.models.person import Person
from app.models.employment import Employment
from app.models.client import Client
from app.models.shift import Shift
from app.models.weekly_care_need import WeeklyCareNeed, CareSlot
from app.models.worker_availability import WorkerAvailabilityEntry
from app.models.placement import CareSlotAssignment
from app.models.placement import PlacementInterest
from app.models.admin_notification import Notification
from app.core.enums import (
    OrgMemberRole,
    WeekDay,
    ServiceType,
    PlacementStatus,
    NotificationType,
)
from app.core.exceptions import AppError
from app.schemas.weekly_care_need import WeeklyCareNeedCreate
from app.schemas.placement import PlacementCreateSchema, PlacementApproval
from app.services.weekly_care_need_service import WeeklyCareNeedService
from app.services.placement_service import PlacementService


@pytest.fixture
def scenario():
    url = os.getenv("CARE_TEST_DATABASE_URL")
    if not url:
        pytest.skip("Requires isolated PostgreSQL CARE_TEST_DATABASE_URL")
    assert make_url(url).database.endswith("_test"), (
        "Refusing to test against a non-test database"
    )
    engine = create_engine(url)
    with engine.connect() as connection:
        outer = connection.begin()
        with Session(bind=connection, join_transaction_mode="create_savepoint") as db:
            user = NS(id=uuid4())
            org = Organization(
                name="Care workflow test",
                owner_id=user.id,
                billing_timezone="America/St_Johns",
            )
            db.add(org)
            db.flush()
            people = [
                Person(
                    first_name=name,
                    last_name="Test",
                    email=f"{uuid4()}@example.invalid",
                    supabase_user_id=user.id if i == 0 else uuid4(),
                )
                for i, name in enumerate(["Admin", "Maria", "James", "Alex"])
            ]
            db.add_all(people)
            db.flush()
            members = [
                Employment(
                    person_id=p.id,
                    org_id=org.id,
                    role=OrgMemberRole.owner
                    if i == 0
                    else OrgMemberRole.home_support_worker,
                    max_hours_per_week=40,
                )
                for i, p in enumerate(people)
            ]
            db.add_all(members)
            db.flush()
            for p in people[1:]:
                db.add_all(
                    [
                        WorkerAvailabilityEntry(
                            person_id=p.id,
                            day_of_week=day,
                            start_time=time(0),
                            end_time=time(23, 59),
                        )
                        for day in WeekDay
                    ]
                )
            client = Client(
                org_id=org.id,
                first_name="Robert",
                last_name="Test",
                date_of_birth=date(1940, 1, 1),
                street="1 Example",
                city="Example",
                province="NL",
                postal_code="A1A1A1",
                emergency_contact_name="Family",
                emergency_contact_phone="555",
                emergency_contact_relationship="Family",
                )
            db.add(client)
            db.flush()
            start = date.today() + timedelta(days=14)
            old = WeeklyCareNeed(
                client_id=client.id,
                org_id=org.id,
                version=1,
                effective_from=date.today() - timedelta(days=180),
                activated_at=datetime.now(timezone.utc),
                created_by=members[0].id,
            )
            db.add(old)
            db.flush()
            old_shifts = []
            for day in (WeekDay.MO, WeekDay.WE, WeekDay.FR):
                slot = CareSlot(
                    weekly_care_need_id=old.id,
                    client_id=client.id,
                    day_of_week=day,
                    start_time=time(9),
                    end_time=time(11),
                    service_type=ServiceType.personal_care,
                )
                db.add(slot)
                db.flush()
                shift = Shift(
                    org_id=org.id,
                    client_id=client.id,
                    worker_id=members[1].id,
                    created_by=members[0].id,
                    weekly_care_need_id=old.id,
                    care_slot_id=slot.id,
                    start_time=datetime.combine(
                        date.today() - timedelta(days=30), time(9)
                    ),
                    end_time=datetime.combine(
                        date.today() - timedelta(days=30), time(11)
                    ),
                    is_recurring=True,
                    recurrence_rule=f"FREQ=WEEKLY;BYDAY={day.value}",
                )
                db.add(shift)
                old_shifts.append(shift)
            unrelated = Shift(
                org_id=org.id,
                client_id=client.id,
                worker_id=members[3].id,
                created_by=members[0].id,
                start_time=datetime.combine(start + timedelta(days=2), time(14)),
                end_time=datetime.combine(start + timedelta(days=2), time(15)),
            )
            db.add(unrelated)
            db.commit()
            service = PlacementService(db, user, org.id)
            service.cutoff_service = (
                MagicMock()
            )  # Billing cutoff has its own transaction suite.
            need_service = WeeklyCareNeedService(db, user)
            need = need_service.create_version(
                client.id,
                WeeklyCareNeedCreate(
                    effective_from=start,
                    care_slots=[
                        dict(
                            day_of_week=day,
                            start_time="09:00",
                            end_time="11:00",
                            service_type="personal_care",
                        )
                        for day in ["TU", "TH", "SA"]
                    ],
                ),
            )
            placement = service.create_placement(
                PlacementCreateSchema(
                    client_id=client.id, weekly_care_need_id=need.id, start_date=start
                )
            )
            slots = {s.day_of_week.value: s for s in need.care_slots}
            for day, worker in [
                ("TU", members[1]),
                ("TH", members[2]),
                ("SA", members[3]),
            ]:
                service.express_interest(placement.id, worker.id, None, [slots[day].id])
            payload = PlacementApproval(
                starts_on=start,
                selections=[
                    dict(care_slot_id=slots["TU"].id, employment_id=members[1].id),
                    dict(care_slot_id=slots["TH"].id, employment_id=members[2].id),
                ],
                accept_uncovered=True,
            )
            yield NS(
                db=db,
                service=service,
                need=need,
                need_service=need_service,
                old=old,
                old_shifts=old_shifts,
                unrelated=unrelated,
                placement=placement,
                slots=slots,
                members=members,
                payload=payload,
                start=start,
                client=client,
            )
        outer.rollback()
    engine.dispose()


def test_partial_transition_and_later_approval_preserve_history(scenario):
    s = scenario
    assert all(x.recurrence_end_date is None for x in s.old_shifts)
    assert s.db.query(Shift).filter(Shift.weekly_care_need_id == s.need.id).count() == 0
    review = s.service.review_approval(s.placement.id, s.payload)
    assert review["all_clear"] and review["ends_previous_schedule"]
    assert all(w["hours"]["max_weekly_hours"] == 40 for w in review["workers"])
    assert [r["day_of_week"] for r in review["uncovered_slots"]] == ["SA"]
    assert all(x.recurrence_end_date is None for x in s.old_shifts), (
        "Preview must roll back every mutation"
    )
    s.payload.review_token = review["review_token"]
    result = s.service.approve_coverage(s.placement.id, s.payload)
    assert result.covered_count == 2 and result.status == PlacementStatus.open
    assert all(
        x.recurrence_end_date == s.start - timedelta(days=1) for x in s.old_shifts
    ), "ALL old weekdays stop, including Friday"
    assert s.unrelated.status.value == "active"
    generated = s.db.query(Shift).filter(Shift.weekly_care_need_id == s.need.id).all()
    assert len(generated) == 2 and {x.care_slot_id for x in generated} == {
        s.slots["TU"].id,
        s.slots["TH"].id,
    }
    assert s.need.scheduled_from == s.start and s.old.ends_on == s.start - timedelta(
        days=1
    )
    notices = (
        s.db.query(Notification)
        .filter(Notification.type == NotificationType.placement_coverage_updated)
        .all()
    )
    assert len(notices) == 1 and "Still available: Sat" in notices[0].payload["message"]
    with pytest.raises(AppError):
        s.service.approve_coverage(s.placement.id, s.payload)
    assert s.db.query(CareSlotAssignment).count() == 2
    later = PlacementApproval(
        starts_on=s.start + timedelta(days=7),
        selections=[dict(care_slot_id=s.slots["SA"].id, employment_id=s.members[3].id)],
    )
    second = s.service.review_approval(s.placement.id, later)
    assert not second["ends_previous_schedule"]
    later.review_token = second["review_token"]
    done = s.service.approve_coverage(s.placement.id, later)
    assert done.status == PlacementStatus.filled and done.covered_count == 3
    assert all(
        x.recurrence_end_date == s.start - timedelta(days=1) for x in s.old_shifts
    )
    assert s.db.query(Shift).filter(Shift.weekly_care_need_id == s.need.id).count() == 3


@pytest.mark.parametrize("direct", [False, True])
def test_notification_failure_rolls_back_cutoff_and_assignments(
    scenario, monkeypatch, direct
):
    s = scenario
    if direct:
        s.payload = direct_payload(s)
    s.payload.review_token = s.service.review_approval(s.placement.id, s.payload)[
        "review_token"
    ]

    def fail(*a, **kw):
        raise RuntimeError("notification storage unavailable")

    monkeypatch.setattr(
        "app.services.notification_service.NotificationService.notify_coverage_approved",
        fail,
    )
    with pytest.raises(RuntimeError):
        s.service.approve_coverage(s.placement.id, s.payload)
    assert s.db.query(CareSlotAssignment).count() == 0
    assert all(x.recurrence_end_date is None for x in s.old_shifts)
    assert s.need.activated_at is None and s.old.ends_on is None
    assert s.db.query(Shift).filter(Shift.weekly_care_need_id == s.need.id).count() == 0


@pytest.mark.parametrize(
    "case",
    [
        "no_review",
        "unacknowledged",
        "no_interest",
        "foreign_worker",
        "availability",
        "conflict",
        "hours",
        "stale_review",
    ],
)
def test_approval_guards(scenario, case):
    s = scenario
    review = s.service.review_approval(s.placement.id, s.payload)
    s.payload.review_token = review["review_token"]
    if case == "no_review":
        s.payload.review_token = None
    elif case == "unacknowledged":
        s.payload.accept_uncovered = False
    elif case == "no_interest":
        s.service.withdraw_interest(s.placement.id, s.members[1].id)
    elif case == "foreign_worker":
        s.payload.selections[0].employment_id = uuid4()
    elif case == "availability":
        s.db.query(WorkerAvailabilityEntry).filter(
            WorkerAvailabilityEntry.person_id == s.members[1].person_id
        ).delete()
        s.db.commit()
    elif case == "hours":
        s.members[1].max_hours_per_week = 1
        s.db.commit()
    elif case == "stale_review":
        s.old_shifts[0].recurrence_end_date = s.start + timedelta(days=30)
        s.db.commit()
    elif case == "conflict":
        first = s.service._first_occurrence_date([WeekDay.TU], s.start)
        s.db.add(
            Shift(
                org_id=s.service.org_id,
                client_id=s.client.id,
                worker_id=s.members[1].id,
                created_by=s.members[0].id,
                start_time=datetime.combine(first, time(9)),
                end_time=datetime.combine(first, time(11)),
            )
        )
        s.db.commit()
    with pytest.raises(AppError):
        s.service.approve_coverage(s.placement.id, s.payload)
    assert s.db.query(CareSlotAssignment).count() == 0
    assert s.need.activated_at is None


def test_replacing_an_unapproved_proposal_preserves_schedule_and_retires_posting(
    scenario,
):
    s = scenario
    replacement = s.need_service.create_version(
        s.client.id,
        WeeklyCareNeedCreate(
            effective_from=s.start + timedelta(days=7),
            care_slots=[
                dict(
                    day_of_week="MO",
                    start_time="14:00",
                    end_time="16:00",
                    service_type="personal_care",
                )
            ],
        ),
    )
    assert replacement.version == 3 and replacement.supersedes_id == s.old.id
    assert len(s.need.care_slots) == 3
    assert s.service.get_placement(s.placement.id).status == PlacementStatus.closed
    assert all(shift.recurrence_end_date is None for shift in s.old_shifts)
    actions = s.need_service.attention_items()
    assert actions[0]["action"] == "Post placement"
    assert actions[0]["weekly_care_need_id"] == str(replacement.id)


def test_foreign_agency_cannot_review_placement(scenario):
    s = scenario
    s.service.org_id = uuid4()
    with pytest.raises(AppError) as error:
        s.service.review_approval(s.placement.id, s.payload)
    assert error.value.status_code == 404


def test_ended_care_need_cannot_be_extended_through_shift_edit(scenario):
    from app.services.shift_service import ShiftService

    s = scenario
    s.payload.review_token = s.service.review_approval(s.placement.id, s.payload)[
        "review_token"
    ]
    s.service.approve_coverage(s.placement.id, s.payload)
    shift_service = ShiftService.__new__(ShiftService)
    shift_service.care_need_repo = s.service.care_need_repo
    shift_service.org_id = s.service.org_id
    with pytest.raises(AppError) as error:
        shift_service._check_coverage_bounds(
            s.old_shifts[0], s.old_shifts[0].start_time, None, True
        )
    assert error.value.code == "CARE_NEED_ENDED"
    shift_service._check_coverage_bounds(
        s.old_shifts[0], s.old_shifts[0].start_time, s.start - timedelta(days=1), True
    )


def direct_payload(s):
    s.db.query(PlacementInterest).filter(
        PlacementInterest.placement_id == s.placement.id
    ).delete()
    s.db.commit()
    return PlacementApproval(
        starts_on=s.start,
        accept_uncovered=True,
        confirm_admin_arranged=True,
        selections=[
            dict(
                care_slot_id=s.slots["TU"].id,
                employment_id=s.members[1].id,
                assignment_source="admin_arranged",
            ),
            dict(
                care_slot_id=s.slots["TH"].id,
                employment_id=s.members[1].id,
                assignment_source="admin_arranged",
            ),
        ],
    )


def test_direct_coverage_without_interest_preserves_transition_history_and_notifications(
    scenario,
):
    s = scenario
    payload = direct_payload(s)
    review = s.service.review_approval(s.placement.id, payload)
    assert review["all_clear"] and review["ends_previous_schedule"]
    assert review["workers"][0]["worker_name"] == "Maria Test"
    assert review["workers"][0]["hours"]["proposed"] > 0
    assert s.db.query(CareSlotAssignment).count() == 0
    payload.review_token = review["review_token"]
    result = s.service.approve_coverage(s.placement.id, payload)
    assert result.covered_count == 2 and result.status == PlacementStatus.open
    assert result.interest_count == 0 and result.interests == []
    assignments = s.db.query(CareSlotAssignment).all()
    assert len(assignments) == 2
    assert all(
        a.assignment_source == "admin_arranged"
        and a.approved_by == s.members[0].id
        and a.approved_at
        for a in assignments
    )
    assert all(
        slot["assignment_source"] == "admin_arranged"
        for slot in result.care_slots
        if slot["worker_id"]
    )
    assert all(
        shift.recurrence_end_date == s.start - timedelta(days=1)
        for shift in s.old_shifts
    )
    assert s.unrelated.status.value == "active"
    assert s.db.query(Shift).filter(Shift.weekly_care_need_id == s.need.id).count() == 2
    assert (
        s.db.query(Notification)
        .filter(
            Notification.type == NotificationType.placement_filled,
            Notification.recipient_id == s.members[1].id,
        )
        .count()
        == 1
    )
    from app.services.assignment_service import AssignmentService

    history = AssignmentService(
        s.db, s.service.current_user, s.service.org_id
    ).list_assignments(client_id=s.client.id)
    assert all(
        a["assignment_source"] == "admin_arranged" for a in history["assignments"]
    )
    with pytest.raises(AppError):
        s.service.approve_coverage(s.placement.id, payload)
    assert s.db.query(CareSlotAssignment).count() == 2
    later = PlacementApproval(
        starts_on=s.start,
        confirm_admin_arranged=True,
        selections=[
            dict(
                care_slot_id=s.slots["SA"].id,
                employment_id=s.members[2].id,
                assignment_source="admin_arranged",
            )
        ],
    )
    later.review_token = s.service.review_approval(s.placement.id, later)[
        "review_token"
    ]
    assert (
        s.service.approve_coverage(s.placement.id, later).status
        == PlacementStatus.filled
    )


@pytest.mark.parametrize(
    "case",
    [
        "confirmation",
        "gaps",
        "review",
        "source_changed",
        "inactive",
        "foreign",
        "admin",
        "availability",
        "conflict",
        "hours",
        "duplicate_slot",
        "unknown_slot",
    ],
)
def test_direct_approval_keeps_all_guards_and_rolls_back(scenario, case):
    from app.core.enums import EmploymentStatus

    s = scenario
    payload = direct_payload(s)
    payload.review_token = s.service.review_approval(s.placement.id, payload)[
        "review_token"
    ]
    if case == "confirmation":
        payload.confirm_admin_arranged = False
    elif case == "gaps":
        payload.accept_uncovered = False
    elif case == "review":
        payload.review_token = None
    elif case == "source_changed":
        s.service.express_interest(
            s.placement.id, s.members[1].id, None, [s.slots["TU"].id]
        )
        payload.selections[0].assignment_source = "worker_interest"
    elif case == "inactive":
        s.members[1].employment_status = EmploymentStatus.terminated
        s.db.commit()
    elif case == "foreign":
        org = Organization(name="Other agency", owner_id=uuid4())
        s.db.add(org)
        s.db.flush()
        s.members[1].org_id = org.id
        s.db.commit()
    elif case == "admin":
        s.members[1].role = OrgMemberRole.manager
        s.db.commit()
    elif case == "availability":
        s.db.query(WorkerAvailabilityEntry).filter(
            WorkerAvailabilityEntry.person_id == s.members[1].person_id
        ).delete()
        s.db.commit()
    elif case == "hours":
        s.members[1].max_hours_per_week = 1
        s.db.commit()
    elif case == "conflict":
        first = s.service._first_occurrence_date([WeekDay.TU], s.start)
        s.db.add(
            Shift(
                org_id=s.service.org_id,
                client_id=s.client.id,
                worker_id=s.members[1].id,
                created_by=s.members[0].id,
                start_time=datetime.combine(first, time(9)),
                end_time=datetime.combine(first, time(11)),
            )
        )
        s.db.commit()
    elif case == "duplicate_slot":
        payload.selections.append(payload.selections[0])
    elif case == "unknown_slot":
        payload.selections[0].care_slot_id = uuid4()
    with pytest.raises(AppError):
        s.service.approve_coverage(s.placement.id, payload)
    assert s.db.query(CareSlotAssignment).count() == 0
    assert s.need.activated_at is None
    assert all(shift.recurrence_end_date is None for shift in s.old_shifts)


def test_mixed_interest_and_direct_assignment_keep_independent_provenance(scenario):
    s = scenario
    s.payload.selections[1].assignment_source = "admin_arranged"
    s.payload.confirm_admin_arranged = True
    s.service.withdraw_interest(s.placement.id, s.members[2].id)
    s.payload.review_token = s.service.review_approval(s.placement.id, s.payload)[
        "review_token"
    ]
    s.service.approve_coverage(s.placement.id, s.payload)
    assert {
        a.care_slot_id: a.assignment_source for a in s.db.query(CareSlotAssignment)
    } == {s.slots["TU"].id: "worker_interest", s.slots["TH"].id: "admin_arranged"}


def test_direct_replacement_preserves_ended_assignment_and_rejects_overlap(scenario):
    from app.schemas.assignment import EndAssignments
    from app.services.assignment_service import AssignmentService

    s = scenario
    payload = direct_payload(s)
    payload.review_token = s.service.review_approval(s.placement.id, payload)[
        "review_token"
    ]
    s.service.approve_coverage(s.placement.id, payload)
    previous = (
        s.db.query(CareSlotAssignment).filter_by(care_slot_id=s.slots["TU"].id).one()
    )
    stop = s.start + timedelta(days=7)
    ending = EndAssignments(
        assignment_ids=[previous.id],
        stops_from=stop,
        reason="Worker arranged replacement by phone",
    )
    manager = AssignmentService(s.db, s.service.current_user, s.service.org_id)
    manager.cutoff_service = MagicMock()
    ending.review_token = manager.review_end(ending)["review_token"]
    manager.end_assignments(ending)
    replacement = PlacementApproval(
        starts_on=s.start,
        accept_uncovered=True,
        confirm_admin_arranged=True,
        selections=[
            dict(
                care_slot_id=s.slots["TU"].id,
                employment_id=s.members[2].id,
                assignment_source="admin_arranged",
            )
        ],
    )
    with pytest.raises(AppError) as error:
        s.service.review_approval(s.placement.id, replacement)
    assert error.value.code == "ASSIGNMENT_OVERLAP"
    replacement.starts_on = stop
    replacement.review_token = s.service.review_approval(s.placement.id, replacement)[
        "review_token"
    ]
    s.service.approve_coverage(s.placement.id, replacement)
    history = (
        s.db.query(CareSlotAssignment).filter_by(care_slot_id=s.slots["TU"].id).all()
    )
    assert len(history) == 2
    assert previous.ends_before == stop and previous.end_reason == ending.reason
    assert all(a.assignment_source == "admin_arranged" for a in history)
    assert sum(a.ends_before is None for a in history) == 1
    assert s.service.get_placement(s.placement.id).interests == []


def test_assignment_source_migration_backfills_and_constrains_existing_rows(scenario):
    import importlib.util
    from pathlib import Path
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    from sqlalchemy import text
    from sqlalchemy.exc import IntegrityError

    s = scenario
    s.payload.review_token = s.service.review_approval(s.placement.id, s.payload)[
        "review_token"
    ]
    s.service.approve_coverage(s.placement.id, s.payload)
    connection = s.db.connection()
    # Recreate the previous table shape inside this isolated rollback transaction.
    connection.execute(
        text("ALTER TABLE care_slot_assignments DROP CONSTRAINT ck_assignment_source")
    )
    connection.execute(
        text("ALTER TABLE care_slot_assignments DROP COLUMN assignment_source")
    )
    path = (
        Path(__file__).resolve().parents[2]
        / "alembic/versions/2e11cbcf7fed_record_care_slot_assignment_source.py"
    )
    spec = importlib.util.spec_from_file_location("assignment_source_migration", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    with Operations.context(MigrationContext.configure(connection)):
        migration.upgrade()
    assert connection.execute(
        text("SELECT assignment_source FROM care_slot_assignments")
    ).scalars().all() == ["worker_interest", "worker_interest"]
    with pytest.raises(IntegrityError), s.db.begin_nested():
        s.db.execute(
            text("UPDATE care_slot_assignments SET assignment_source = 'fabricated'")
        )


@pytest.mark.parametrize("offset", [-7, 0, 7])
def test_replace_approved_future_revision_before_on_or_after_start(scenario, offset):
    from app.domain.scheduling import expand_occurrences
    from app.models.shift_modification import ShiftModification
    from app.core.enums import ShiftCompletionStatus

    s = scenario
    past = date.today() - timedelta(days=7)
    historical = ShiftModification(
        shift_id=s.old_shifts[0].id, original_date=past,
        new_start_time=datetime.combine(past, time(10)),
        new_end_time=datetime.combine(past, time(12)),
        completion_status=ShiftCompletionStatus.cancelled,
        cancellation_reason="Client unavailable", notes="Keep this history",
    )
    s.db.add(historical)
    s.db.commit()
    s.payload.review_token = s.service.review_approval(s.placement.id, s.payload)["review_token"]
    s.service.approve_coverage(s.placement.id, s.payload)
    initial_shifts = s.db.query(Shift).filter(Shift.weekly_care_need_id == s.need.id).all()
    original_cutoff = s.old.ends_on
    start = s.start + timedelta(days=offset)
    replacement = s.need_service.create_version(s.client.id, WeeklyCareNeedCreate(
        effective_from=start,
        care_slots=[dict(day_of_week="MO", start_time="10:00", end_time="12:00")],
    ))
    assert replacement.supersedes_id == s.need.id
    assert s.need.ends_on is None and s.old.ends_on == original_cutoff
    assert all(shift.recurrence_end_date is None for shift in initial_shifts)
    posted = s.service.create_placement(PlacementCreateSchema(
        client_id=s.client.id, weekly_care_need_id=replacement.id, start_date=start,
    ))
    assert all(shift.recurrence_end_date is None for shift in initial_shifts)
    payload = PlacementApproval(starts_on=start, confirm_admin_arranged=True, selections=[dict(
        care_slot_id=replacement.care_slots[0].id, employment_id=s.members[1].id,
        assignment_source="admin_arranged",
    )])
    review = s.service.review_approval(posted.id, payload)
    assert review["all_clear"]
    expected_ids = {str(shift.id) for shift in initial_shifts}
    if offset < 0:
        expected_ids.update(str(shift.id) for shift in s.old_shifts)
    assert {shift["shift_id"] for shift in review["old_shifts"]} == expected_ids
    # Review must leave both generations intact.
    assert s.need.ends_on is None and s.old.ends_on == original_cutoff
    assert all(shift.recurrence_end_date is None for shift in initial_shifts)
    payload.review_token = review["review_token"]
    result = s.service.approve_coverage(posted.id, payload)
    assert result.covered_count == 1 and result.status == PlacementStatus.filled
    assert s.need.ends_on == start - timedelta(days=1)
    assert s.old.ends_on == min(original_cutoff, start - timedelta(days=1))
    for shift in [*s.old_shifts, *initial_shifts]:
        assert not expand_occurrences(shift, start, start + timedelta(days=21))
    if offset > 0:
        assert any(expand_occurrences(shift, s.start, start - timedelta(days=1)) for shift in initial_shifts)
    assert historical.new_start_time == datetime.combine(past, time(10))
    assert historical.completion_status == ShiftCompletionStatus.cancelled
    assert historical.cancellation_reason == "Client unavailable"
    assert historical.notes == "Keep this history"
    assert s.unrelated.status.value == "active"
    assert s.db.query(CareSlotAssignment).count() == 3
    with pytest.raises(AppError):
        s.service.review_approval(s.placement.id, s.payload)

    # A second future replacement can move earlier again, across the whole chain.
    earliest = date.today() + timedelta(days=2)
    third = s.need_service.create_version(s.client.id, WeeklyCareNeedCreate(
        effective_from=earliest,
        care_slots=[dict(day_of_week="MO", start_time="10:00", end_time="12:00")],
    ))
    third_post = s.service.create_placement(PlacementCreateSchema(
        client_id=s.client.id, weekly_care_need_id=third.id, start_date=earliest,
    ))
    third_payload = PlacementApproval(starts_on=earliest, confirm_admin_arranged=True, selections=[dict(
        care_slot_id=third.care_slots[0].id, employment_id=s.members[1].id,
        assignment_source="admin_arranged",
    )])
    third_review = s.service.review_approval(third_post.id, third_payload)
    assert third_review["all_clear"]
    third_payload.review_token = third_review["review_token"]
    s.service.approve_coverage(third_post.id, third_payload)
    assert all(n.ends_on == earliest - timedelta(days=1) for n in [s.old, s.need, replacement])
    old_ids = [s.old.id, s.need.id, replacement.id]
    for shift in s.db.query(Shift).filter(Shift.weekly_care_need_id.in_(old_ids)):
        assert not expand_occurrences(shift, earliest, earliest + timedelta(days=35))
