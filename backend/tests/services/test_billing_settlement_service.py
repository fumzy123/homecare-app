from copy import deepcopy
from datetime import datetime, timedelta, timezone
from uuid import uuid4
from unittest.mock import MagicMock

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.billing_settlement import BillingSettlement
from app.models.organization import Organization
from app.models.billing_period import BillingPeriod
from app.models.billing_usage_snapshot import BillingUsageSnapshot
from app.models.billing_adjustment import BillingAdjustment
from app.services.billing_settlement_service import BillingSettlementService, SettlementBusy, SettlementReviewRequired
from app.services.stripe_usage_gateway import StripeUsageGateway
from app.services import stripe_usage_gateway as gateway_module


@pytest.fixture
def service(monkeypatch):
    monkeypatch.setattr(settings, "billing_onboarding_enabled", True)
    monkeypatch.setattr(settings, "billing_settlement_enabled", True)
    monkeypatch.setattr(settings, "billing_settlement_live_enabled", False)
    engine = create_engine("sqlite://")
    for model in (Organization, BillingPeriod, BillingUsageSnapshot, BillingAdjustment, BillingSettlement):
        model.__table__.create(engine)
    with Session(engine, autoflush=False) as db:
        yield BillingSettlementService(db)
    engine.dispose()


def operation(service, amount=500):
    now = datetime.now(timezone.utc)
    row = BillingSettlement(id=uuid4(), org_id=uuid4(), period_id=uuid4(), source_key=str(uuid4()),
        amount_cents=amount, currency="cad", state="ready", context=dict(customer="cus_test", subscription="sub_test",
        interval="year", starts_at=now.isoformat(), ends_at=(now + timedelta(days=30)).isoformat(), rate=500),
        steps={}, created_at=now, updated_at=now)
    service.db.add(row)
    service.db.commit()
    return row.id


def test_claim_excludes_second_worker_and_rejects_old_lease(service):
    sid = operation(service)
    _, old = service.claim(sid)
    assert service.claim(sid) is None
    row = service.db.get(BillingSettlement, sid)
    row.lease_until = datetime.now(timezone.utc) - timedelta(seconds=1)
    service.db.commit()
    _, new = service.claim(sid)
    assert old != new
    with pytest.raises(SettlementBusy):
        service.step(sid, old, "invoice", {}, lambda _: None, lambda *_: "unexpected")


def test_timeout_retry_uses_saved_arguments_and_same_key(service):
    sid = operation(service)
    _, token = service.claim(sid)
    calls = []

    def send(params, key):
        assert service.db.get(BillingSettlement, sid).steps["invoice"]["params"] == params
        calls.append((params, key))
        if len(calls) == 1:
            raise TimeoutError()
        return "in_test"

    with pytest.raises(TimeoutError):
        service.step(sid, token, "invoice", {"amount": 500}, lambda _: None, send)
    assert service.step(sid, token, "invoice", {"amount": 999}, lambda _: None, send) == "in_test"
    assert calls[0] == calls[1]
    assert service.step(sid, token, "invoice", {}, lambda _: None, send) == "in_test"
    assert len(calls) == 2


@pytest.mark.parametrize("recovered", [None, "in_recovered"])
def test_old_ambiguous_creation_is_recovered_or_stopped(service, recovered):
    sid = operation(service)
    _, token = service.claim(sid)
    row = service.db.get(BillingSettlement, sid)
    row.steps = {"invoice": {"params": {}, "attempted_at": (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()}}
    service.db.commit()
    send = MagicMock()
    if recovered:
        assert service.step(sid, token, "invoice", {}, lambda _: recovered, send) == recovered
    else:
        with pytest.raises(SettlementReviewRequired, match="AMBIGUOUS_OPERATION_EXPIRED"):
            service.step(sid, token, "invoice", {}, lambda _: None, send)
    send.assert_not_called()


def test_live_customer_is_rejected_before_any_mutation(service, monkeypatch):
    sid = operation(service)
    op, token = service.claim(sid)
    fake = MagicMock()
    fake.Customer.retrieve.return_value = {"id": "cus_test", "livemode": True}
    monkeypatch.setattr(gateway_module, "stripe", fake)
    with pytest.raises(SettlementReviewRequired, match="LIVE_SETTLEMENT_DISABLED"):
        StripeUsageGateway(service, op, token).run()
    fake.Invoice.create.assert_not_called()
    fake.InvoiceItem.create.assert_not_called()


def test_zero_annual_usage_never_creates_invoice(service, monkeypatch):
    sid = operation(service, 0)
    op, token = service.claim(sid)
    fake = MagicMock()
    fake.Customer.retrieve.return_value = {"id": "cus_test", "livemode": False}
    monkeypatch.setattr(gateway_module, "stripe", fake)
    assert StripeUsageGateway(service, op, token).run() == dict(state="zero", payment_status="not_required")
    fake.Invoice.create.assert_not_called()


def test_open_invoice_reconciliation_never_creates_or_charges_again(service, monkeypatch):
    import stripe
    sid = operation(service)
    op, token = service.claim(sid)
    op = {**deepcopy(op), "invoice_id": "in_open", "invoice_line_id": "il_usage"}
    fake = MagicMock()
    fake.Customer.retrieve.return_value = {"id": "cus_test"}
    fake.Invoice.retrieve.return_value = stripe.StripeObject.construct_from(
        dict(id="in_open", customer="cus_test", currency="cad", status="open"), None)
    monkeypatch.setattr(gateway_module, "stripe", fake)
    assert StripeUsageGateway(service, op, token).run()["payment_status"] == "open"
    fake.Invoice.create.assert_not_called()
    fake.Invoice.pay.assert_not_called()


def test_preparation_is_unique_and_credits_wait_for_original_invoice(service):
    db = service.db
    org, pid = uuid4(), uuid4()
    start = datetime(2026, 8, 1, tzinfo=timezone.utc)
    end = datetime(2026, 9, 1, tzinfo=timezone.utc)
    db.add(Organization(id=org, name="Agency", owner_id=uuid4(), stripe_customer_id="cus_test"))
    terms = dict(subscription_id="sub_test", starts_at=start.isoformat(), ends_at=end.isoformat(),
                 base_interval="month", additional_client_amount_cents=500, currency="cad")
    db.add(BillingPeriod(id=pid, org_id=org, subscription_id="sub_test", starts_at=start, ends_at=end,
        anchor_at=start, agency_timezone="UTC", plan_code="standard", plan_version=1,
        base_interval="month", included_clients=10, additional_client_amount_cents=500,
        currency="cad", finalization_eligible_at=end))
    db.add(BillingUsageSnapshot(period_id=pid, org_id=org, finalized_at=end, active_client_count=12,
        additional_clients=2, usage_amount_cents=1000, payload={"period": terms}))
    aid = uuid4()
    db.add(BillingAdjustment(id=aid, org_id=org, period_id=pid, request_id=uuid4(), baseline_sequence=0,
        approval_sequence=1, status="approved", amount_cents=-500, currency="cad", reason="Correction",
        proposed_by=uuid4(), proposed_at=end, settlement_status="pending", payload={}))
    db.commit()
    service.prepare(org, pid)
    service.prepare(org, pid)
    assert db.query(BillingSettlement).count() == 1
    base = db.query(BillingSettlement).one()
    base.state, base.invoice_id, base.invoice_line_id = "invoiced", "in_base", "il_usage"
    db.commit()
    service.prepare(org, pid)
    service.prepare(org, pid)
    assert db.query(BillingSettlement).count() == 2
    credit = service.settlement_repo.by_source(f"adjustment:{aid}")
    assert credit.context["credits"] == [dict(source_id=str(base.id), invoice="in_base", line="il_usage", amount=500)]


def test_nullable_stripe_parent_uses_default():
    from app.core.stripe_objects import stripe_field
    assert stripe_field(None, "invoice_item") is None
    assert stripe_field(None, "data", []) == []


@pytest.mark.parametrize("invoice_status,refund_amount,refund_status,expected", [
    ("open", 0, None, "credited"), ("paid", 500, "succeeded", "credited"),
    ("paid", 500, "pending", "refund_pending"), ("paid", 500, "failed", "REFUND_FAILED"),
])
def test_credit_reduces_unpaid_debt_or_tracks_paid_refund(service, monkeypatch, invoice_status,
                                                       refund_amount, refund_status, expected):
    import stripe
    def obj(**values):
        return stripe.StripeObject.construct_from(values, None)
    sid = operation(service, -500)
    op, token = service.claim(sid)
    op["context"]["credits"] = [dict(invoice="in_original", line="il_usage", amount=500)]
    fake = MagicMock()
    fake.Customer.retrieve.return_value = obj(id="cus_test", livemode=False)
    fake.Invoice.retrieve.return_value = obj(id="in_original", customer="cus_test", status=invoice_status, currency="cad")
    fake.CreditNote.list.return_value.auto_paging_iter.side_effect = lambda: iter([])
    fake.CreditNote.preview.return_value = obj(post_payment_amount=refund_amount)
    fake.CreditNote.create.return_value = obj(id="cn_test")
    fake.CreditNote.retrieve.return_value = obj(id="cn_test", customer="cus_test", invoice="in_original",
        currency="cad", status="issued", refunds=[{"refund": "re_test"}] if refund_status else [])
    fake.Refund.retrieve.return_value = obj(id="re_test", status=refund_status)
    monkeypatch.setattr(gateway_module, "stripe", fake)
    gateway = StripeUsageGateway(service, op, token)
    if expected == "REFUND_FAILED":
        with pytest.raises(SettlementReviewRequired, match=expected):
            gateway.run()
    else:
        assert gateway.run()["payment_status"] == expected
        assert gateway.run()["payment_status"] == expected
    fake.CreditNote.create.assert_called_once()
    assert fake.CreditNote.create.call_args.kwargs["refund_amount"] == refund_amount
    assert fake.CreditNote.create.call_args.kwargs["lines"] == [dict(type="invoice_line_item", invoice_line_item="il_usage", amount=500)]
