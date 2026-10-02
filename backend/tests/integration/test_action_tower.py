"""Real PostgreSQL activity, recipient isolation and transactional request tests."""

import asyncio
import os
from datetime import datetime, date, timedelta, timezone
from types import SimpleNamespace as NS
from uuid import uuid4
import pytest
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session
from app.models import Organization, Person, Employment, Client, Shift
from app.models.activity import ActivityEvent, OvertimeRequest
from app.models.admin_notification import NotificationRead
from app.core.enums import (
    OrgMemberRole,
    NotificationType,
    TargetAudience,
    CareArrangement,
)
from app.core.exceptions import AppError
from app.repositories.activity_repository import ActivityRepository
from app.repositories.notification_repository import NotificationRepository
from app.services.activity_service import ActivityService
from app.services.attention_service import AttentionService
from app.services.overtime_service import OvertimeService
from app.schemas.activity import ReadActivity
from app.schemas.shift import (
    OvertimeApprovalRequestSchema,
    OvertimeApproveSchema,
    OvertimeRejectSchema,
)


@pytest.fixture
def scene():
    url = os.getenv("CARE_TEST_DATABASE_URL")
    if not url:
        pytest.skip("Requires isolated PostgreSQL CARE_TEST_DATABASE_URL")
    assert make_url(url).database.endswith("_test")
    engine = create_engine(url)
    with engine.connect() as conn:
        outer = conn.begin()
        with Session(bind=conn, join_transaction_mode="create_savepoint") as db:
            org = Organization(
                name="Tower test", owner_id=uuid4(), billing_timezone="America/St_Johns"
            )
            other = Organization(
                name="Other agency",
                owner_id=uuid4(),
                billing_timezone="America/St_Johns",
            )
            db.add_all([org, other])
            db.flush()
            people = [
                Person(
                    first_name=name,
                    last_name="Test",
                    email=f"{uuid4()}@example.invalid",
                    supabase_user_id=uuid4(),
                )
                for name in ("Owner", "Manager", "Worker", "Other", "Supervisor")
            ]
            db.add_all(people)
            db.flush()
            members = [
                Employment(
                    person_id=p.id,
                    org_id=other.id if i == 3 else org.id,
                    role=[
                        OrgMemberRole.owner,
                        OrgMemberRole.manager,
                        OrgMemberRole.home_support_worker,
                        OrgMemberRole.owner,
                        OrgMemberRole.supervisor,
                    ][i],
                )
                for i, p in enumerate(people)
            ]
            db.add_all(members)
            db.flush()
            client = Client(
                org_id=org.id,
                first_name="Client",
                last_name="Test",
                date_of_birth=date(1940, 1, 1),
                street="Example",
                city="Example",
                province="NL",
                postal_code="A1A1A1",
                care_arrangement=CareArrangement.self_pay,
                emergency_contact_name="Family",
                emergency_contact_phone="555",
                emergency_contact_relationship="Family",
            )
            db.add(client)
            db.flush()
            yield NS(
                db=db,
                org=org,
                other=other,
                people=people,
                members=members,
                client=client,
                users=[NS(id=p.supabase_user_id) for p in people],
            )
        outer.rollback()
    engine.dispose()


def test_reading_updates_never_resolves_work_and_is_per_admin(scene):
    s = scene
    repo = NotificationRepository(s.db)
    notice = repo.create(
        s.org.id,
        NotificationType.profile_updated,
        {"changed_fields": ["phone_number"]},
        False,
        about_worker_id=s.members[2].id,
        triggered_by_id=s.members[2].id,
    )
    repo.create_reads_for_admins(notice.id, s.org.id)
    s.db.flush()
    owner = ActivityService(s.db, s.users[0])
    manager = ActivityService(s.db, s.users[1])
    entry = owner.list_entries().entries[0]
    assert entry.unread and entry.title == "Worker Test updated their profile"
    owner.mark_read(ReadActivity(notification_ids=[notice.id]))
    assert not owner.list_entries().entries[0].unread
    assert manager.list_entries().entries[0].unread
    assert notice.resolved_at is None
    assert not ActivityService(s.db, s.users[3]).list_entries().entries
    ActivityService(s.db, s.users[3]).mark_read(
        ReadActivity(notification_ids=[notice.id])
    )
    assert (
        s.db.query(NotificationRead)
        .filter_by(notification_id=notice.id, recipient_id=s.members[3].id)
        .count()
        == 0
    )


def test_history_pagination_role_scope_and_local_day(scene):
    s = scene
    repo = ActivityRepository(s.db)
    stamp = datetime(2026, 10, 2, 2, 0, tzinfo=timezone.utc)  # Oct 1 in Newfoundland
    for i in range(5):
        e = repo.record(
            s.org.id, s.members[0].id, "care:test", "coverage", f"Action {i}"
        )
        e.created_at = stamp
    e = repo.record(
        s.org.id, s.members[1].id, "care:test", "coverage", "Manager action"
    )
    e.created_at = stamp
    repo.record(s.org.id, s.members[0].id, "invoice:test", "billing", "Payment action")
    s.db.flush()
    svc = ActivityService(s.db, s.users[0])
    page = svc.list_entries(scope="mine", day=date(2026, 10, 1), limit=2)
    seen = []
    while True:
        seen.extend(e.id for e in page.entries)
        if not page.next_cursor:
            break
        page = svc.list_entries(
            scope="mine", day=date(2026, 10, 1), limit=2, cursor=page.next_cursor
        )
    assert len(seen) == len(set(seen)) == 5
    assert not svc.list_entries(day=date(2026, 10, 2), situation="care:test").entries
    assert all(
        e.category != "billing"
        for e in ActivityService(s.db, s.users[1]).list_entries().entries
    )
    assert ActivityRepository(s.db).unread_by_situation(s.members[1])["care:test"] == 5


def request_payload(s):
    starts = datetime.now().replace(
        hour=9, minute=0, second=0, microsecond=0
    ) + timedelta(days=21)
    return OvertimeApprovalRequestSchema(
        worker_id=s.members[2].id,
        client_id=s.client.id,
        client_name="Untrusted name",
        week_start=starts.date().isoformat(),
        week_end=(starts.date() + timedelta(days=6)).isoformat(),
        total_hours=42,
        start_time=starts,
        end_time=starts + timedelta(hours=2),
    )


def test_overtime_has_one_decision_and_completed_activity(scene):
    s = scene
    svc = OvertimeService(s.db, s.users[0])
    payload = request_payload(s)
    svc.request(payload)
    svc.request(payload)
    requests = s.db.query(OvertimeRequest).filter_by(org_id=s.org.id).all()
    assert len(requests) == 1
    request = requests[0]
    assert request.details["client_name"] == "Client Test"
    with pytest.raises(AppError) as blocked:
        OvertimeService(s.db, s.users[4]).reject(
            OvertimeRejectSchema(notification_id=request.notification_id)
        )
    assert blocked.value.status_code == 403
    shift = asyncio.run(
        svc.approve(OvertimeApproveSchema(notification_id=request.notification_id))
    )
    assert request.status == "approved" and request.shift_id == shift.id
    assert (
        s.db.query(ActivityEvent)
        .filter_by(org_id=s.org.id, title="Overtime approved")
        .count()
        == 1
    )
    assert not [
        i
        for i in AttentionService(s.db, s.users[0]).list_items().items
        if i.stage == "review_overtime"
    ]
    with pytest.raises(AppError) as again:
        asyncio.run(
            svc.approve(OvertimeApproveSchema(notification_id=request.notification_id))
        )
    assert again.value.code == "REQUEST_DECIDED"
    assert s.db.query(Shift).filter_by(org_id=s.org.id).count() == 1


def test_rejection_retains_reason_and_requester_sees_waiting(scene):
    s = scene
    OvertimeService(s.db, s.users[4]).request(request_payload(s))
    request = s.db.query(OvertimeRequest).filter_by(org_id=s.org.id).one()
    item = next(
        i
        for i in AttentionService(s.db, s.users[4]).list_items().items
        if i.stage == "await_approval"
    )
    assert item.urgency == "waiting"
    OvertimeService(s.db, s.users[1]).reject(
        OvertimeRejectSchema(
            notification_id=request.notification_id,
            reason="Different coverage arranged",
        )
    )
    assert (
        request.status == "rejected"
        and request.decision_note == "Different coverage arranged"
    )
    assert not [
        i
        for i in AttentionService(s.db, s.users[4]).list_items().items
        if i.stage == "await_approval"
    ]


def test_worker_notifications_remain_outside_admin_activity(scene):
    s = scene
    repo = NotificationRepository(s.db)
    n = repo.create(
        s.org.id,
        NotificationType.placement_created,
        {},
        True,
        target_audience=TargetAudience.workers_only,
    )
    repo.create_reads_for_workers(n.id, s.org.id)
    s.db.flush()
    assert not ActivityService(s.db, s.users[0]).list_entries().entries
    assert len(repo.list_for_worker(s.members[2].id, s.org.id)) == 1


def test_failed_approval_rolls_back_shift_decision_and_activity(scene, monkeypatch):
    s = scene
    svc = OvertimeService(s.db, s.users[0])
    svc.request(request_payload(s))
    request = s.db.query(OvertimeRequest).filter_by(org_id=s.org.id).one()
    notification_id = request.notification_id
    original = svc.activity_repo.record

    def fail(*args, **kwargs):
        raise RuntimeError("activity insert failed")

    monkeypatch.setattr(svc.activity_repo, "record", fail)
    with pytest.raises(RuntimeError, match="activity insert failed"):
        asyncio.run(svc.approve(OvertimeApproveSchema(notification_id=notification_id)))
    s.db.expire_all()
    assert request.status == "pending" and request.shift_id is None
    assert s.db.query(Shift).filter_by(org_id=s.org.id).count() == 0
    assert s.db.query(ActivityEvent).filter_by(org_id=s.org.id).count() == 0
    assert svc.notification_repo.get_by_id(notification_id).resolved_at is None
    monkeypatch.setattr(svc.activity_repo, "record", original)
    asyncio.run(svc.approve(OvertimeApproveSchema(notification_id=notification_id)))
    assert s.db.query(Shift).filter_by(org_id=s.org.id).count() == 1


@pytest.mark.parametrize("scope", ["all", "this", "following"])
def test_overtime_schedule_changes_update_existing_care_atomically(scene, scope):
    from app.schemas.shift import ShiftCreateSchema, RecurrenceSchema
    from app.services.shift_service import ShiftService
    from app.models.shift_modification import ShiftModification

    s = scene
    base = request_payload(s)
    master = asyncio.run(
        ShiftService(s.db, s.users[0]).create_shift(
            ShiftCreateSchema(
                worker_id=base.worker_id,
                client_id=base.client_id,
                start_time=base.start_time,
                end_time=base.end_time,
                recurrence=RecurrenceSchema(frequency="daily")
                if scope != "all"
                else None,
            )
        )
    )
    start = base.start_time + timedelta(days=1 if scope == "following" else 0, hours=3)
    end = start + timedelta(hours=2)
    changes = (
        {"start_time": start.isoformat(), "end_time": end.isoformat()}
        if scope == "all"
        else {
            "new_start_time": start.isoformat(),
            "new_end_time": end.isoformat(),
            "original_date"
            if scope == "this"
            else "occurrence_date": start.date().isoformat(),
        }
    )
    data = base.model_dump() | dict(
        shift_id=master.id,
        edit_scope=scope,
        changes=changes,
        start_time=start,
        end_time=end,
    )
    svc = OvertimeService(s.db, s.users[0])
    svc.request(OvertimeApprovalRequestSchema(**data))
    request = s.db.query(OvertimeRequest).filter_by(org_id=s.org.id).one()
    asyncio.run(
        svc.approve(OvertimeApproveSchema(notification_id=request.notification_id))
    )
    assert request.status == "approved"
    assert s.db.query(Shift).filter_by(org_id=s.org.id).count() == (
        2 if scope == "following" else 1
    )
    if scope == "this":
        assert (
            s.db.query(ShiftModification)
            .filter_by(shift_id=master.id)
            .one()
            .new_start_time
            == start
        )
    if scope == "all":
        assert master.start_time == start


def test_schedule_changed_after_request_requires_new_review(scene):
    from app.schemas.shift import ShiftCreateSchema
    from app.services.shift_service import ShiftService

    s = scene
    base = request_payload(s)
    master = asyncio.run(
        ShiftService(s.db, s.users[0]).create_shift(
            ShiftCreateSchema(
                worker_id=base.worker_id,
                client_id=base.client_id,
                start_time=base.start_time,
                end_time=base.end_time,
            )
        )
    )
    svc = OvertimeService(s.db, s.users[0])
    svc.request(
        OvertimeApprovalRequestSchema(
            **(
                base.model_dump()
                | dict(
                    shift_id=master.id,
                    edit_scope="all",
                    changes={
                        "start_time": (base.start_time + timedelta(hours=3)).isoformat()
                    },
                )
            )
        )
    )
    request = s.db.query(OvertimeRequest).filter_by(org_id=s.org.id).one()
    master.notes = "Changed by another manager"
    s.db.commit()
    with pytest.raises(AppError) as stale:
        asyncio.run(
            svc.approve(OvertimeApproveSchema(notification_id=request.notification_id))
        )
    assert stale.value.code == "SCHEDULE_CHANGED"
    assert request.status == "pending" and master.start_time == base.start_time


def test_migration_preserves_legacy_updates_reads_and_unknown_decisions(scene):
    # DDL is transactional inside the fixture's isolated PostgreSQL transaction.
    import importlib.util
    from pathlib import Path
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    from sqlalchemy import text

    s = scene
    repo = NotificationRepository(s.db)
    notices = []
    for resolved in (False, True):
        notice = repo.create(
            s.org.id,
            NotificationType.overtime_approval_requested,
            {"client_name": "Legacy request"},
            True,
            about_worker_id=s.members[2].id,
            triggered_by_id=s.members[0].id,
        )
        repo.create_reads_for_approvers(notice.id, s.org.id)
        if resolved:
            repo.mark_resolved(notice, s.members[1].id)
        repo.mark_read(notice.id, s.members[0].id)
        notices.append(notice.id)
    s.db.commit()
    file = next(
        (Path(__file__).parents[2] / "alembic/versions").glob("e02d964f8383_*.py")
    )
    spec = importlib.util.spec_from_file_location("tower_migration", file)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    with Operations.context(MigrationContext.configure(s.db.connection())):
        migration.downgrade()
        migration.upgrade()
    s.db.expire_all()
    records = {
        r.notification_id: r
        for r in s.db.query(OvertimeRequest).filter_by(org_id=s.org.id)
    }
    assert records[notices[0]].status == "pending"
    assert records[notices[1]].status == "reviewed"
    assert records[notices[1]].decided_by == s.members[1].id
    assert all(repo.get_by_id(n).situation_key == f"notice:{n}" for n in notices)
    assert all(
        not entry.unread
        for entry in ActivityService(s.db, s.users[0]).list_entries().entries
    )
    assert all(
        s.db.execute(
            text("SELECT relrowsecurity FROM pg_class WHERE relname = :name"),
            {"name": name},
        ).scalar()
        for name in ("activity_events", "activity_reads", "overtime_requests")
    )
