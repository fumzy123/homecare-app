from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock
from uuid import uuid4
import asyncio

import pytest
import stripe
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.enums import ShiftStatus
from app.core.exceptions import AppError
from app.models.organization import Organization
from app.models.billing_agreement import BillingAgreement
from app.models.founding_conversion import FoundingConversion
from app.models.billing_period import BillingPeriod
from app.models.billing_usage_cutoff import BillingUsageCutoff
from app.models.billing_visit_evidence import BillingVisitEvidence
from app.models.billing_usage_snapshot import BillingUsageSnapshot
from app.models.shift import Shift
from app.models.shift_modification import ShiftModification
from app.services.billing_cutoff_service import BillingCutoffService
from app.services.billing_finalization_service import BillingFinalizationService
from app.services.billing_period_recovery_service import BillingPeriodRecoveryService
from app.services import billing_period_recovery_service as recovery_module
from app.services.shift_service import ShiftService
from app.services.billing_evidence_service import BillingEvidenceService
from app.repositories.shift_repository import ShiftRepository
from app.schemas.shift import ShiftCancelSchema
from app.domain.billing_recovery import invoice_periods


def dt(month, day=1, year=2026):
    return datetime(year, month, day, tzinfo=timezone.utc)


@pytest.fixture
def db():
    engine = create_engine("sqlite://")
    for model in (Organization, BillingAgreement, FoundingConversion, BillingPeriod, BillingUsageCutoff,
                  BillingVisitEvidence, BillingUsageSnapshot, Shift, ShiftModification):
        model.__table__.create(engine)
    with Session(engine, autoflush=False) as session:
        yield session
    engine.dispose()


def agency(db, *, anchor=None, tracking=True, interval="month"):
    anchor = anchor or dt(9)
    org_id = uuid4()
    db.add(Organization(id=org_id, name="Agency", owner_id=uuid4(), stripe_customer_id="cus_test",
        subscription_id="sub_test", subscription_status="active", trial_ends_at=anchor, billing_timezone="UTC",
        onboarding_deadline_at=anchor - timedelta(days=14),
        billing_usage_tracking_started_at=anchor if tracking else None))
    db.add(BillingAgreement(org_id=org_id, plan_code="standard", plan_version=1, base_interval=interval,
        stripe_price_id="price_standard", consent_version="test", accepted_at=anchor, accepted_by=uuid4()))
    db.commit()
    return org_id


def visit(db, org):
    sid, client = uuid4(), uuid4()
    db.add(Shift(id=sid, org_id=org, client_id=client, worker_id=uuid4(), created_by=uuid4(),
        start_time=datetime(2026, 9, 12, 9), end_time=datetime(2026, 9, 12, 11),
        status=ShiftStatus.active, is_recurring=False))
    db.commit()
    return sid, client


def invoice(start, end, amount=30000, price="price_standard", identifier="in_test"):
    line = dict(id="il_" + identifier, amount=amount, currency="cad", quantity=1,
        period=dict(start=int(start.timestamp()), end=int(end.timestamp())),
        parent=dict(type="subscription_item_details", subscription_item_details=dict(subscription="sub_test", proration=False)),
        pricing=dict(price_details=dict(price=price)))
    return dict(id=identifier, customer="cus_test", status="paid",
        parent=dict(subscription_details=dict(subscription="sub_test")), lines=dict(data=[line], has_more=False))


def remote(monkeypatch, anchor, invoices, *, ended=None):
    fake = MagicMock()
    fake.Subscription.retrieve.return_value = stripe.StripeObject.construct_from(dict(
        id="sub_test", customer="cus_test", trial_end=int(anchor.timestamp()),
        status="canceled" if ended else "active", ended_at=int(ended.timestamp()) if ended else None), None)
    fake.Invoice.list.return_value.auto_paging_iter.side_effect = lambda: iter([
        stripe.StripeObject.construct_from(row, None) for row in invoices])
    monkeypatch.setattr(recovery_module, "stripe", fake)
    return fake


def test_recovers_missing_months_without_billing_page_and_is_idempotent(db, monkeypatch):
    org = agency(db, anchor=dt(1, 31))
    history = [invoice(dt(1, 31), dt(2, 28), identifier="jan"),
               invoice(dt(2, 28), dt(3, 31), identifier="feb"),
               invoice(dt(3, 31), dt(4, 30), identifier="mar")]
    fake = remote(monkeypatch, dt(1, 31), history)
    service = BillingPeriodRecoveryService(db)
    assert service.recover(org, now=dt(4, 4)) == 3
    assert service.recover(org, now=dt(4, 4)) == 3
    rows = db.query(BillingPeriod).order_by(BillingPeriod.starts_at).all()
    assert len(rows) == 3
    assert [row.starts_at.day for row in rows] == [31, 28, 31]
    assert [row.source_invoice_id for row in rows] == ["jan", "feb", "mar"]
    fake.Invoice.create.assert_not_called()
    fake.Subscription.modify.assert_not_called()


def test_annual_coverage_creates_only_started_monthly_windows(db, monkeypatch):
    org = agency(db, anchor=dt(1, 31), interval="year")
    remote(monkeypatch, dt(1, 31), [invoice(dt(1, 31), dt(1, 31, 2027), amount=300000)])
    assert BillingPeriodRecoveryService(db).recover(org, now=dt(4, 4)) == 3
    assert {row.base_interval for row in db.query(BillingPeriod)} == {"year"}
    assert {row.included_clients for row in db.query(BillingPeriod)} == {10}


def test_line_pagination_is_fully_consumed(db, monkeypatch):
    org = agency(db)
    inv = invoice(dt(9), dt(10))
    lines = inv["lines"]["data"]
    inv["lines"] = dict(data=[], has_more=True)
    fake = remote(monkeypatch, dt(9), [inv], ended=dt(10))
    fake.Invoice.list_lines.return_value.auto_paging_iter.return_value = iter(lines)
    assert BillingPeriodRecoveryService(db).recover(org, now=dt(10, 4)) == 1
    fake.Invoice.list_lines.assert_called_once_with("in_test", limit=100)


def test_failure_records_review_and_never_creates_unverified_period(db, monkeypatch):
    org = agency(db)
    remote(monkeypatch, dt(9), [invoice(dt(9), dt(10), price="price_unknown")])
    with pytest.raises(ValueError, match="pricing"):
        BillingPeriodRecoveryService(db).recover(org, now=dt(9, 15))
    assert db.query(BillingPeriod).count() == 0
    assert db.get(Organization, org).billing_recovery_error == "BILLING_PERIOD_RECOVERY_FAILED"


def test_delayed_job_uses_pre_late_edit_count_even_when_period_was_missing(db, monkeypatch):
    org = agency(db)
    sid, client = visit(db, org)
    deadline = dt(10, 4)
    service = ShiftService.__new__(ShiftService)
    service.db, service.org_id = db, org
    service.shift_repo = ShiftRepository(db)
    service._get_active_shift = lambda _: db.get(Shift, sid)
    service.evidence_service = BillingEvidenceService(db, org)
    cutoff = BillingCutoffService(db)
    service.cutoff_service = MagicMock()
    service.cutoff_service.seal_due.side_effect = lambda oid: cutoff.seal_due(oid, now=deadline + timedelta(hours=2))
    asyncio.run(service.cancel_shift(sid, ShiftCancelSchema()))
    # No period existed when the late cancellation was accepted.
    assert db.query(BillingPeriod).count() == 0
    assert db.query(BillingUsageCutoff).one().clients[0]["client_id"] == str(client)
    db.commit()
    remote(monkeypatch, dt(9), [invoice(dt(9), dt(10))], ended=dt(10))
    BillingPeriodRecoveryService(db).recover(org, now=deadline + timedelta(hours=3))
    pid = db.query(BillingPeriod.id).scalar()
    db.commit()
    result = BillingFinalizationService(db).finalize(org, pid, now=deadline + timedelta(hours=3))
    assert result["active_client_count"] == 1
    assert result["clients"][0]["client_id"] == str(client)
    assert result["cutoff_at"] == deadline.isoformat()


def test_pre_deadline_correction_changes_usage_and_late_creation_does_not(db):
    org = agency(db)
    sid, _ = visit(db, org)
    service = BillingCutoffService(db)
    service.seal_due(org, now=dt(10, 4) - timedelta(microseconds=1))
    db.get(Shift, sid).status = ShiftStatus.cancelled
    db.commit()
    service.seal_due(org, now=dt(10, 4))
    db.commit()
    visit(db, org)  # A backdated creation after the cutoff cannot alter its snapshot.
    service.seal_due(org, now=dt(10, 5))
    db.commit()
    assert db.query(BillingUsageCutoff).one().clients == []


def test_pre_tracking_history_is_marked_review_not_reconstructed(db):
    org = agency(db, tracking=False)
    visit(db, org)
    BillingCutoffService(db).seal_due(org, now=dt(10, 4))
    db.commit()
    row = db.query(BillingUsageCutoff).one()
    assert row.state == "needs_review" and row.reason == "TRACKING_STARTED_AFTER_DEADLINE"
    assert row.clients is None


def test_cutoff_and_mutation_rollback_together(db):
    org = agency(db)
    sid, _ = visit(db, org)
    BillingCutoffService(db).seal_due(org, now=dt(10, 4))
    db.get(Shift, sid).status = ShiftStatus.cancelled
    db.rollback()
    assert db.query(BillingUsageCutoff).count() == 0
    assert db.get(Shift, sid).status == ShiftStatus.active


def test_partial_cancellation_is_held_for_review(db, monkeypatch):
    org = agency(db)
    remote(monkeypatch, dt(9), [invoice(dt(9), dt(10))], ended=dt(9, 20))
    BillingPeriodRecoveryService(db).recover(org, now=dt(10, 4))
    assert db.query(BillingPeriod).count() == 0
    assert db.get(Organization, org).billing_recovery_error == "PARTIAL_CANCELLATION_REVIEW_REQUIRED"


def test_error_blocks_finalization_of_previous_verified_period(db, monkeypatch):
    org = agency(db)
    remote(monkeypatch, dt(9), [invoice(dt(9), dt(10))], ended=dt(10))
    BillingPeriodRecoveryService(db).recover(org, now=dt(10, 4))
    pid = db.query(BillingPeriod.id).scalar()
    db.get(Organization, org).billing_recovery_error = "BILLING_PERIOD_RECOVERY_FAILED"
    db.commit()
    with pytest.raises(AppError) as error:
        BillingFinalizationService(db).finalize(org, pid, now=dt(10, 4))
    assert error.value.code == "BILLING_PERIOD_REVIEW_REQUIRED"


def test_founding_conversion_uses_each_invoice_historical_price():
    context = dict(subscription_id="sub_test", customer_id="cus_test", anchor=dt(9),
        plan_code="founding", plan_version=1, interval="month", price_id="price_founding",
        conversion=dict(effective_at=dt(10), version=1, price_id="price_standard"))
    sub = dict(id="sub_test", customer="cus_test", trial_end=int(dt(9).timestamp()))
    invs = [invoice(dt(9), dt(10), amount=20000, price="price_founding"), invoice(dt(10), dt(11))]
    output, partial = invoice_periods(context, sub, [(i, i["lines"]["data"]) for i in invs], dt(10, 15))
    assert not partial
    assert output[dt(9)][1].additional_client_amount_cents == 400
    assert output[dt(10)][1].additional_client_amount_cents == 500


@pytest.mark.parametrize("change", ["proration", "gap", "foreign", "duplicate", "trial", "manual"])
def test_unsafe_coverage_is_not_inferred(change):
    context = dict(subscription_id="sub_test", customer_id="cus_test", anchor=dt(9),
        plan_code="standard", plan_version=1, interval="month", price_id="price_standard")
    sub = dict(id="sub_test", customer="cus_test", trial_end=int(dt(9).timestamp()))
    inv = invoice(dt(9), dt(10))
    line = inv["lines"]["data"][0]
    if change == "proration":
        line["parent"]["subscription_item_details"]["proration"] = True
    elif change == "foreign":
        inv["customer"] = "foreign"
    elif change == "trial":
        line["period"]["start"], line["period"]["end"] = int(dt(8).timestamp()), int(dt(9).timestamp())
    elif change == "manual":
        line["parent"] = dict(type="invoice_item_details")
    history = [] if change == "gap" else [(inv, [line])]
    if change == "duplicate":
        history *= 2
    with pytest.raises(ValueError):
        invoice_periods(context, sub, history, dt(9, 15))


def test_remote_reads_hold_no_database_transaction_and_recheck_context(db, monkeypatch):
    org = agency(db)
    fake = remote(monkeypatch, dt(9), [invoice(dt(9), dt(10))])
    original = fake.Subscription.retrieve.return_value

    def change_terms(_):
        assert not db.in_transaction()
        db.query(BillingAgreement).filter(BillingAgreement.org_id == org).one().stripe_price_id = "price_changed"
        db.commit()
        return original

    fake.Subscription.retrieve.side_effect = change_terms
    with pytest.raises(ValueError, match="terms changed"):
        BillingPeriodRecoveryService(db).recover(org, now=dt(9, 15))
    assert db.query(BillingPeriod).count() == 0
    assert db.get(Organization, org).billing_recovery_error == "BILLING_PERIOD_RECOVERY_FAILED"


def test_recovery_does_not_overwrite_existing_terms(db, monkeypatch):
    org = agency(db)
    remote(monkeypatch, dt(9), [invoice(dt(9), dt(10))])
    BillingPeriodRecoveryService(db).recover(org, now=dt(9, 15))
    row = db.query(BillingPeriod).one()
    row.additional_client_amount_cents = 700
    db.commit()
    with pytest.raises(ValueError, match="Stored period"):
        BillingPeriodRecoveryService(db).recover(org, now=dt(9, 15))
    assert db.query(BillingPeriod).one().additional_client_amount_cents == 700


def test_guard_refreshes_data_read_before_acquiring_agency_lock(db):
    org = agency(db)
    sid, _ = visit(db, org)
    stale = db.get(Shift, sid)
    assert stale.status == ShiftStatus.active
    # Simulate a committed update while this session had an older ORM object.
    with db.bind.begin() as connection:
        connection.execute(Shift.__table__.update().where(Shift.id == sid).values(status=ShiftStatus.cancelled))
    BillingCutoffService(db).seal_due(org, now=dt(10, 4))
    db.commit()
    assert db.query(BillingUsageCutoff).one().clients == []


def test_repeated_cutoff_capture_does_not_replace_first_snapshot(db):
    org = agency(db)
    sid, client = visit(db, org)
    service = BillingCutoffService(db)
    service.seal_due(org, now=dt(10, 4))
    db.commit()
    original = db.query(BillingUsageCutoff).one().clients
    db.get(Shift, sid).status = ShiftStatus.cancelled
    db.commit()
    service.seal_due(org, now=dt(10, 5))
    db.commit()
    assert db.query(BillingUsageCutoff).count() == 1
    assert db.query(BillingUsageCutoff).one().clients == original
    assert original[0]["client_id"] == str(client)
