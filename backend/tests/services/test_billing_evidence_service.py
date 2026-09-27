import asyncio
from datetime import date, datetime, timedelta, timezone
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.enums import ShiftCompletionStatus as Status, ShiftStatus
from app.core.exceptions import AppError
from app.domain.billing_usage import UsageWindow, active_clients
from app.models.shift import Shift
from app.models.shift_modification import ShiftModification
from app.models.billing_visit_evidence import BillingVisitEvidence
from app.repositories.billing_usage_repository import BillingUsageRepository
from app.repositories.billing_evidence_repository import BillingEvidenceRepository
from app.repositories.shift_repository import ShiftRepository, ShiftModificationRepository
from app.schemas.shift import ShiftCancelFromSchema, ShiftModificationUpdateSchema, ShiftUpdateSchema
from app.services.billing_evidence_service import BillingEvidenceService
from app.services.shift_service import ShiftService
from app.services.shift_completion_service import ShiftCompletionService


@pytest.fixture
def db():
    engine = create_engine("sqlite://")
    for model in (Shift, ShiftModification, BillingVisitEvidence):
        model.__table__.create(engine)
    with Session(engine) as session:
        yield session
    engine.dispose()


def visit(db, status=Status.completed, start=None):
    start = start or datetime(2026, 9, 12, 9)
    shift = Shift(id=uuid4(), org_id=uuid4(), client_id=uuid4(), worker_id=uuid4(),
                  created_by=uuid4(), start_time=start, end_time=start + timedelta(hours=2),
                  is_recurring=True, recurrence_rule="FREQ=DAILY", recurrence_end_date=start.date(),
                  status=ShiftStatus.active)
    mod = ShiftModification(id=uuid4(), shift_id=shift.id, original_date=start.date(), completion_status=status)
    db.add_all([shift, mod])
    db.commit()
    return shift, mod


def estimate(db, org, month=9):
    window = UsageWindow(datetime(2026, month, 1, tzinfo=timezone.utc),
                         datetime(2026, month + 1, 1, tzinfo=timezone.utc), "UTC")
    candidates = BillingUsageRepository(db).candidates(org, window)
    evidence = BillingEvidenceRepository(db).for_window(org, window, [c.shift.id for c in candidates])
    return active_clients(candidates, window, evidence)


def shift_service(db, shift):
    service = ShiftService.__new__(ShiftService)
    service.db, service.org_id = db, shift.org_id
    service.shift_repo = ShiftRepository(db)
    service.modification_repo = ShiftModificationRepository(db)
    service.evidence_service = BillingEvidenceService(db, shift.org_id)
    service._get_active_shift = lambda _: shift
    service._enforce_scheduling_rules = MagicMock()
    service._validate_shift_participants = MagicMock()
    return service


def test_series_cancellation_retains_deleted_override_and_original_client(db):
    shift, mod = visit(db)
    client, org = shift.client_id, shift.org_id
    # A later original occurrence is moved into the period, then truncated away.
    mod.original_date = date(2026, 9, 15)
    mod.new_start_time = datetime(2026, 9, 12, 9)
    shift.recurrence_end_date = date(2026, 9, 15)
    db.commit()
    service = shift_service(db, shift)
    asyncio.run(service.cancel_from_date(shift.id, ShiftCancelFromSchema(occurrence_date=date(2026, 9, 13))))
    assert db.query(ShiftModification).count() == 0
    # Further edits to the master cannot transfer the delivered visit.
    shift.client_id = uuid4()
    shift.status = ShiftStatus.cancelled
    db.commit()
    result = estimate(db, org)
    assert [row.client_id for row in result] == [client]
    assert result[0].local_start == datetime(2026, 9, 12, 9)
    assert estimate(db, uuid4()) == ()


def test_master_reassignment_preserves_historical_client(db):
    shift, _ = visit(db)
    original = shift.client_id
    asyncio.run(shift_service(db, shift).update_shift(shift.id, ShiftUpdateSchema(client_id=uuid4())))
    assert [row.client_id for row in estimate(db, shift.org_id)] == [original]


def test_explicit_corrections_append_versions_and_move_usage_out_of_period(db):
    shift, mod = visit(db)
    service = shift_service(db, shift)
    asyncio.run(service.update_modification(shift.id, mod.original_date,
        ShiftModificationUpdateSchema(new_start_time=datetime(2026, 10, 3, 9))))
    assert estimate(db, shift.org_id) == ()
    assert len(estimate(db, shift.org_id, 10)) == 1
    rows = db.query(BillingVisitEvidence).order_by(BillingVisitEvidence.revision).all()
    assert [row.local_start.month for row in rows] == [9, 10]
    asyncio.run(service.update_modification(shift.id, mod.original_date,
        ShiftModificationUpdateSchema(completion_status=Status.cancelled)))
    assert estimate(db, shift.org_id, 10) == ()
    assert db.query(BillingVisitEvidence).count() == 3
    # A note-only edit is not a financial revision.
    asyncio.run(service.update_modification(shift.id, mod.original_date,
        ShiftModificationUpdateSchema(notes="corrected note")))
    assert db.query(BillingVisitEvidence).count() == 3


def test_failed_edit_rolls_back_staged_evidence_and_schedule(db):
    shift, _ = visit(db)
    original = shift.start_time
    service = shift_service(db, shift)
    service._enforce_scheduling_rules.side_effect = AppError(409, "CONFLICT", "conflict")
    with pytest.raises(AppError):
        asyncio.run(service.update_shift(shift.id, ShiftUpdateSchema(start_time=original - timedelta(hours=1))))
    assert db.query(BillingVisitEvidence).count() == 0
    assert shift.start_time == original


@pytest.mark.parametrize("status", [Status.dropped, Status.cancelled, Status.no_show, Status.in_progress])
def test_completion_does_not_overwrite_non_scheduled_visits(db, status):
    shift, mod = visit(db, status=status)
    service = ShiftCompletionService(db)
    service.shift_repo = MagicMock()
    service.shift_repo.completion_candidates.return_value = [(shift, "UTC", None)]
    service.complete(datetime(2026, 9, 12, 15, tzinfo=timezone.utc))
    assert mod.completion_status == status


def test_completion_uses_agency_time_and_records_evidence(db):
    shift, mod = visit(db, status=Status.scheduled)
    service = ShiftCompletionService(db)
    service.shift_repo = MagicMock()
    service.shift_repo.completion_candidates.return_value = [(shift, "America/St_Johns", None)]
    service.complete(datetime(2026, 9, 12, 12, tzinfo=timezone.utc))
    assert mod.completion_status == Status.scheduled  # 09:30 local, not ended.
    service.complete(datetime(2026, 9, 12, 15, tzinfo=timezone.utc))
    assert mod.completion_status == Status.completed
    assert db.query(BillingVisitEvidence).count() == 1
    service.complete(datetime(2026, 9, 12, 16, tzinfo=timezone.utc))
    assert db.query(BillingVisitEvidence).count() == 1


def test_explicit_reopen_counts_only_while_live(db):
    shift, mod = visit(db)
    asyncio.run(shift_service(db, shift).update_modification(shift.id, mod.original_date,
        ShiftModificationUpdateSchema(completion_status=Status.scheduled)))
    assert len(estimate(db, shift.org_id)) == 1
    shift.status = ShiftStatus.cancelled
    db.commit()
    assert estimate(db, shift.org_id) == ()


def test_archiving_client_preserves_history_before_truncation(db):
    from app.models.client import Client
    from app.services.client_service import ClientService
    Client.__table__.create(db.bind)
    shift, mod = visit(db)
    # Use today so the archive path actually deletes this override.
    today = date.today()
    shift.start_time = datetime.combine(today, datetime.min.time()).replace(hour=9)
    shift.end_time = shift.start_time + timedelta(hours=2)
    shift.recurrence_end_date = today
    mod.original_date = today
    db.commit()
    client = MagicMock()
    service = ClientService.__new__(ClientService)
    service.db, service.org_id = db, shift.org_id
    service.client_repo = MagicMock()
    service.client_repo.get_active_client.return_value = client
    service.shift_repo = ShiftRepository(db)
    service.evidence_service = BillingEvidenceService(db, shift.org_id)
    asyncio.run(service.delete_client(shift.client_id))
    assert db.query(ShiftModification).count() == 0
    evidence = db.query(BillingVisitEvidence).one()
    assert evidence.client_id == shift.client_id
    assert evidence.local_start == shift.start_time
    assert client.deleted_at is not None


def test_deleted_cancelled_correction_cannot_resurrect_usage(db):
    shift, mod = visit(db)
    service = shift_service(db, shift)
    asyncio.run(service.update_modification(shift.id, mod.original_date,
        ShiftModificationUpdateSchema(completion_status=Status.cancelled)))
    db.delete(mod)
    db.commit()
    assert estimate(db, shift.org_id) == ()
    db.expire_all()
    completion = ShiftCompletionService(db)
    completion.shift_repo = MagicMock()
    completion.shift_repo.completion_candidates.return_value = [(shift, "UTC", None)]
    completion.complete(datetime(2026, 9, 12, 15, tzinfo=timezone.utc))
    assert db.query(ShiftModification).count() == 0
    assert estimate(db, shift.org_id) == ()


def test_completion_respects_new_start_without_new_end(db):
    shift, mod = visit(db, status=Status.scheduled)
    mod.new_start_time = datetime(2026, 9, 12, 16)
    db.commit()
    service = ShiftCompletionService(db)
    service.shift_repo = MagicMock()
    service.shift_repo.completion_candidates.return_value = [(shift, "UTC", None)]
    service.complete(datetime(2026, 9, 12, 15, tzinfo=timezone.utc))
    assert mod.completion_status == Status.scheduled


def test_completion_failure_rolls_back_both_visit_and_evidence(db, monkeypatch):
    shift, mod = visit(db, status=Status.scheduled)
    service = ShiftCompletionService(db)
    service.shift_repo = MagicMock()
    service.shift_repo.completion_candidates.return_value = [(shift, "UTC", None)]
    monkeypatch.setattr(db, "commit", MagicMock(side_effect=RuntimeError("commit failed")))
    with pytest.raises(RuntimeError):
        service.complete(datetime(2026, 9, 12, 15, tzinfo=timezone.utc))
    assert mod.completion_status == Status.scheduled
    assert db.query(BillingVisitEvidence).count() == 0


def test_completion_waits_through_dst_fold_and_skips_nonexistent_times():
    from zoneinfo import ZoneInfo
    from app.services.shift_completion_service import _has_ended
    zone = ZoneInfo("America/New_York")
    end = datetime(2026, 11, 1, 1, 30)
    assert not _has_ended(end, zone, datetime(2026, 11, 1, 6, tzinfo=timezone.utc))
    assert _has_ended(end, zone, datetime(2026, 11, 1, 7, tzinfo=timezone.utc))
    assert not _has_ended(datetime(2026, 3, 8, 2, 30), zone,
                          datetime(2026, 3, 8, 12, tzinfo=timezone.utc))
