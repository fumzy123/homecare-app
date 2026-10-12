from datetime import datetime, timedelta, timezone
from uuid import uuid4
from unittest.mock import MagicMock

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.enums import ShiftCompletionStatus, ShiftStatus
from app.core.exceptions import AppError
from app.models.organization import Organization
from app.models.billing_usage_cutoff import BillingUsageCutoff
from app.models.billing_period import BillingPeriod
from app.models.billing_usage_snapshot import BillingUsageSnapshot
from app.models.billing_visit_evidence import BillingVisitEvidence
from app.models.shift import Shift
from app.models.shift_modification import ShiftModification
from app.repositories.billing_finalization_repository import BillingFinalizationRepository
from app.services.billing_finalization_service import BillingFinalizationService
from app.services.billing_usage_service import BillingUsageService

START = datetime(2026, 9, 1, tzinfo=timezone.utc)
END = datetime(2026, 10, 1, tzinfo=timezone.utc)
DUE = END + timedelta(hours=72)


@pytest.fixture
def db():
    engine = create_engine("sqlite://")
    for model in (Organization, BillingUsageCutoff, BillingPeriod, BillingUsageSnapshot, Shift, ShiftModification, BillingVisitEvidence):
        model.__table__.create(engine)
    with Session(engine, autoflush=False) as session:
        yield session
    engine.dispose()


def period(db, **overrides):
    values = dict(id=uuid4(), org_id=uuid4(), subscription_id="sub_test", starts_at=START, ends_at=END,
                  anchor_at=START, agency_timezone="UTC", plan_code="standard", plan_version=1,
                  base_interval="month", included_clients=10, additional_client_amount_cents=500,
                  currency="cad", finalization_eligible_at=DUE, source_invoice_id="in_verified", source_invoice_line_id="il_verified")
    values.update(overrides)
    db.add(Organization(id=values["org_id"], name="Test", owner_id=uuid4(), subscription_id=values["subscription_id"],
        billing_timezone=values["agency_timezone"], trial_ends_at=values["anchor_at"], onboarding_deadline_at=START,
        billing_usage_tracking_started_at=values["starts_at"] - timedelta(days=1), billing_recovery_checked_at=DUE))
    db.add(BillingPeriod(**values))
    db.commit()
    return values["org_id"], values["id"]


def shift(db, org, client_id=None, status=ShiftCompletionStatus.scheduled):
    row = Shift(id=uuid4(), org_id=org, client_id=client_id or uuid4(), worker_id=uuid4(),
                created_by=uuid4(), start_time=datetime(2026, 9, 10, 9), end_time=datetime(2026, 9, 10, 11),
                status=ShiftStatus.active, is_recurring=False)
    db.add(row)
    db.add(ShiftModification(id=uuid4(), shift_id=row.id, original_date=row.start_time.date(),
                            completion_status=status))
    return row.id, row.client_id


def test_refuses_before_deadline_and_accepts_exact_deadline_with_zero_usage(db):
    org, pid = period(db)
    service = BillingFinalizationService(db)
    with pytest.raises(AppError) as error:
        service.finalize(org, pid, now=DUE - timedelta(microseconds=1))
    assert error.value.code == "CORRECTION_WINDOW_OPEN"
    result = service.finalize(org, pid, now=DUE)
    assert result["state"] == "finalized" and not result["is_estimate"]
    assert result["active_client_count"] == result["additional_clients"] == result["usage_amount_cents"] == 0
    assert result["clients"] == []


@pytest.mark.parametrize("interval,rate,code", [("month", 500, "standard"), ("year", 500, "standard"), ("month", 400, "founding")])
def test_distinct_clients_and_saved_rates(db, interval, rate, code):
    org, pid = period(db, base_interval=interval, additional_client_amount_cents=rate, plan_code=code)
    for _ in range(12):
        _, client = shift(db, org)
        shift(db, org, client_id=client)
    shift(db, org, status=ShiftCompletionStatus.cancelled)
    shift(db, org, status=ShiftCompletionStatus.dropped)
    shift(db, uuid4())
    db.commit()
    result = BillingFinalizationService(db).finalize(org, pid, now=DUE)
    assert result["active_client_count"] == 12
    assert result["additional_clients"] == 2
    assert result["usage_amount_cents"] == 2 * rate
    assert len(result["clients"]) == 12
    assert result["period"]["base_interval"] == interval
    assert result["period"]["additional_client_amount_cents"] == rate


def test_retry_and_read_do_not_recalculate_after_schedule_or_rate_changes(db):
    org, pid = period(db, included_clients=0)
    sid, _ = shift(db, org)
    db.commit()
    original = BillingFinalizationService(db).finalize(org, pid, now=DUE)
    row = db.get(Shift, sid)
    row.status = ShiftStatus.cancelled
    db.get(BillingPeriod, pid).additional_client_amount_cents = 9999
    db.commit()
    service = BillingFinalizationService(db)
    service.usage_repo = MagicMock(side_effect=AssertionError("must not recount"))
    repeated = service.finalize(org, pid, now=DUE + timedelta(days=5))
    assert repeated == original
    assert BillingUsageService(db, None, org).finalized(pid) == original
    assert db.query(BillingUsageSnapshot).count() == 1


def test_tenant_scope_on_finalization_and_snapshot_reads(db):
    org, pid = period(db)
    with pytest.raises(AppError) as error:
        BillingFinalizationService(db).finalize(uuid4(), pid, now=DUE)
    assert error.value.status_code == 404
    BillingFinalizationService(db).finalize(org, pid, now=DUE)
    with pytest.raises(AppError) as error:
        BillingUsageService(db, None, uuid4()).finalized(pid)
    assert error.value.status_code == 404


def test_evidence_version_is_copied_and_later_revision_cannot_change_snapshot(db):
    org, pid = period(db)
    sid, client = shift(db, org)
    eid = uuid4()
    db.add(BillingVisitEvidence(id=eid, org_id=org, shift_id=sid, client_id=client, occurrence_date=START.date(),
        revision=1, local_start=datetime(2026, 9, 1, 9), completion_status="completed", source="schedule_preservation"))
    db.commit()
    original = BillingFinalizationService(db).finalize(org, pid, now=DUE)
    witness = original["clients"][0]
    assert witness["evidence_id"] == str(eid) and witness["evidence_revision"] == 1
    db.add(BillingVisitEvidence(org_id=org, shift_id=sid, client_id=client, occurrence_date=START.date(),
        revision=2, local_start=datetime(2026, 9, 1, 9), completion_status="cancelled", source="visit_correction"))
    db.commit()
    assert BillingFinalizationService(db).finalize(org, pid, now=DUE + timedelta(days=1)) == original


def test_invalid_dst_evidence_is_not_silently_finalized_as_zero(db):
    org, pid = period(db, starts_at=datetime(2026, 3, 1, tzinfo=timezone.utc),
        ends_at=datetime(2026, 4, 1, tzinfo=timezone.utc), anchor_at=datetime(2026, 3, 1, tzinfo=timezone.utc),
        finalization_eligible_at=datetime(2026, 4, 4, tzinfo=timezone.utc), agency_timezone="America/New_York")
    sid, _ = shift(db, org)
    db.flush()
    row = db.get(Shift, sid)
    row.start_time = datetime(2026, 3, 8, 2, 30)
    row.end_time = datetime(2026, 3, 8, 4)
    db.commit()
    with pytest.raises(AppError) as error:
        BillingFinalizationService(db).finalize(org, pid, now=DUE)
    assert error.value.code == "USAGE_CUTOFF_REVIEW_REQUIRED"
    assert db.query(BillingUsageSnapshot).count() == 0


def test_failed_commit_leaves_period_pending(db, monkeypatch):
    org, pid = period(db)
    monkeypatch.setattr(db, "commit", MagicMock(side_effect=RuntimeError("write failed")))
    with pytest.raises(RuntimeError):
        BillingFinalizationService(db).finalize(org, pid, now=DUE)
    assert db.query(BillingUsageSnapshot).count() == 0
    assert BillingFinalizationRepository(db).due_periods(DUE) == [(org, pid)]


def test_due_query_excludes_open_and_finalized_periods(db):
    org, pid = period(db)
    period(db, finalization_eligible_at=DUE + timedelta(days=1))
    BillingFinalizationService(db).finalize(org, pid, now=DUE)
    assert BillingFinalizationRepository(db).due_periods(DUE) == []


def test_requires_fresh_session_for_consistent_snapshot(db):
    org, pid = period(db)
    db.get(BillingPeriod, pid)
    with pytest.raises(ValueError, match="fresh"):
        BillingFinalizationService(db).finalize(org, pid, now=DUE)
