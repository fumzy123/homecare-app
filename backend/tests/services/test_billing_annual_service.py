from datetime import datetime, timedelta, timezone
from uuid import uuid4
from unittest.mock import MagicMock
import pytest
import stripe
from dateutil.relativedelta import relativedelta
from app.models.organization import Organization
from app.models.billing_period import BillingPeriod
from app.models.billing_usage_snapshot import BillingUsageSnapshot
from app.models.billing_adjustment import BillingAdjustment
from app.models.billing_settlement import BillingSettlement, BillingInvoiceHold
from app.services.billing_annual_service import BillingAnnualService
from app.services.stripe_usage_gateway import StripeUsageGateway
from app.services.billing_settlement_service import SettlementReviewRequired
from app.services import billing_annual_service as annual_module
from app.services import stripe_usage_gateway as gateway_module
from app.core.config import settings
from tests.services.test_billing_settlement_service import service  # noqa: F401


def obj(**values):
    return stripe.StripeObject.construct_from(values, None)


@pytest.fixture
def year(service, monkeypatch):
    BillingInvoiceHold.__table__.create(service.db.get_bind())
    start = datetime(2025, 1, 1, tzinfo=timezone.utc)
    end = start + relativedelta(years=1)
    org_id = uuid4()
    service.db.add(Organization(id=org_id, name="Annual agency", owner_id=uuid4(), stripe_customer_id="cus_test"))
    ids = []
    for month in range(12):
        a, b = start + relativedelta(months=month), start + relativedelta(months=month + 1)
        pid = uuid4()
        ids.append(pid)
        terms = dict(subscription_id="sub_test", starts_at=a.isoformat(), ends_at=b.isoformat(),
            base_interval="year", plan_version=2, additional_client_amount_cents=500, currency="cad")
        service.db.add(BillingPeriod(id=pid, org_id=org_id, subscription_id="sub_test", starts_at=a, ends_at=b,
            source_invoice_id="in_year", source_invoice_line_id="il_base", anchor_at=start, agency_timezone="UTC",
            plan_code="standard", plan_version=2, base_interval="year", included_clients=10,
            additional_client_amount_cents=500, currency="cad", finalization_eligible_at=b + timedelta(hours=72)))
        service.db.add(BillingUsageSnapshot(period_id=pid, org_id=org_id, finalized_at=b + timedelta(hours=72),
            active_client_count=30, additional_clients=20, usage_amount_cents=10000, payload={"period": terms}))
    service.db.commit()
    for pid in ids:
        service.prepare(org_id, pid)
    remote = MagicMock()
    remote.Invoice.retrieve.return_value = obj(id="in_year", status="paid", customer="cus_test")
    remote.Invoice.list_lines.return_value.auto_paging_iter.side_effect = lambda: iter([
        obj(id="il_base", period={"start": int(start.timestamp()), "end": int(end.timestamp())})])
    monkeypatch.setattr(annual_module, "stripe", remote)
    return org_id, ids, start, end, BillingAnnualService(service.db)


def test_annual_usage_accrues_without_monthly_collection(service, year):
    assert {r.state for r in service.db.query(BillingSettlement)} == {"accrued"}
    assert service.settlement_repo.work_ids() == []


def test_year_waits_for_exact_correction_deadline_and_all_months(service, year):
    org, ids, _, end, annual = year
    annual.prepare_year(org, "in_year", "il_base", now=end + timedelta(hours=72) - timedelta(seconds=1))
    assert service.db.query(BillingSettlement).count() == 12
    snapshot = service.db.get(BillingUsageSnapshot, ids[-1])
    service.db.delete(snapshot)
    service.db.commit()
    annual.prepare_year(org, "in_year", "il_base", now=end + timedelta(hours=72))
    assert service.db.query(BillingSettlement).count() == 12


def test_approved_corrections_are_netted_and_batch_is_idempotent(service, year):
    org, ids, _, end, annual = year
    adjustment = BillingAdjustment(id=uuid4(), org_id=org, period_id=ids[0], request_id=uuid4(),
        baseline_sequence=0, approval_sequence=1, status="approved", amount_cents=-500, currency="cad",
        reason="Correction", proposed_by=uuid4(), proposed_at=end, settlement_status="pending", payload={})
    service.db.add(adjustment)
    service.db.commit()
    annual.prepare_year(org, "in_year", "il_base", now=end + timedelta(hours=72))
    annual.prepare_year(org, "in_year", "il_base", now=end + timedelta(hours=73))
    batch = service.settlement_repo.by_source("annual:in_year:il_base")
    assert batch.amount_cents == 119500
    assert len(batch.context["annual_entries"]) == 12
    assert batch.context["annual_entries"][0]["amount"] == 9500
    assert service.db.query(BillingSettlement).count() == 13
    _, token = service.claim(batch.id)
    batch.steps = {f"line-{pid}": {"result_id": f"line-{pid}"} for pid in ids}
    service.db.commit()
    service.finish(batch.id, token, "invoiced", invoice_id="in_combined", payment_status="paid")
    assert adjustment.settlement_status == "settled"
    original = service.settlement_repo.by_source(f"usage:{ids[0]}")
    assert original.context["invoice_amount"] == 9500
    assert original.invoice_line_id == f"line-{ids[0]}"
    service.prepare(org, ids[0])
    assert service.db.query(BillingSettlement).count() == 13


def test_missing_renewal_hold_cannot_create_second_invoice(service, year, monkeypatch):
    org, _, _, end, annual = year
    annual.prepare_year(org, "in_year", "il_base", now=end + timedelta(hours=72))
    batch = service.settlement_repo.by_source("annual:in_year:il_base")
    operation, token = service.claim(batch.id)
    remote = MagicMock()
    remote.Customer.retrieve.return_value = obj(id="cus_test")
    remote.Subscription.retrieve.return_value = obj(id="sub_test", customer="cus_test", status="active")
    monkeypatch.setattr(gateway_module, "stripe", remote)
    with pytest.raises(SettlementReviewRequired, match="ANNUAL_RENEWAL_HOLD_REQUIRED"):
        StripeUsageGateway(service, operation, token).run()
    remote.Invoice.create.assert_not_called()


@pytest.mark.parametrize("cancelled", [False, True])
def test_one_invoice_contains_all_months_and_retries_reuse_it(service, year, monkeypatch, cancelled):
    org, ids, _, end, annual = year
    annual.prepare_year(org, "in_year", "il_base", now=end + timedelta(hours=72))
    batch = service.settlement_repo.by_source("annual:in_year:il_base")
    operation, token = service.claim(batch.id)
    monkeypatch.setattr(settings, "billing_usage_tax_mode", "none")
    invoice = obj(id="in_collection", customer="cus_test", currency="cad", status="draft", automatic_tax={"enabled": False},
        metadata={"care_harbor_usage_start": batch.context["starts_at"]})
    lines, items = [], {}
    if not cancelled:
        service.db.add(BillingInvoiceHold(invoice_id=invoice.id, org_id=org, subscription_id="sub_test",
            usage_starts_at=datetime.fromisoformat(batch.context["starts_at"]), usage_ends_at=end,
            state="held", base_line_id="il_renewal", base_amount_cents=336000))
        service.db.commit()
        lines.append(obj(id="il_renewal", amount=336000))
    remote = MagicMock()
    remote.Customer.retrieve.return_value = obj(id="cus_test")
    remote.Subscription.retrieve.return_value = obj(id="sub_test", customer="cus_test", status="canceled", ended_at=int(end.timestamp()))
    remote.Invoice.retrieve.return_value = invoice
    remote.Invoice.list.return_value.auto_paging_iter.side_effect = lambda: iter([])
    remote.Invoice.create.return_value = invoice
    remote.Invoice.list_lines.return_value.auto_paging_iter.side_effect = lambda: iter(lines)
    remote.InvoiceItem.list.return_value.auto_paging_iter.side_effect = lambda: iter(items.values())
    def create_item(**params):
        params.pop("idempotency_key")
        item = obj(id=f"ii_{len(items)}", amount=params["quantity"] * int(params["unit_amount_decimal"]), **params)
        items[item.id] = item
        lines.append(obj(id=f"il_{item.id}", amount=item.amount, invoice_item=item.id))
        return item
    remote.InvoiceItem.create.side_effect = create_item
    remote.InvoiceItem.retrieve.side_effect = items.__getitem__
    def finalize(*args, **kwargs):
        assert len(items) == 12
        invoice.status = "open"
        return invoice
    def pay(*args, **kwargs):
        invoice.status = "paid"
        return invoice
    remote.Invoice.finalize_invoice.side_effect = finalize
    remote.Invoice.pay.side_effect = pay
    monkeypatch.setattr(gateway_module, "stripe", remote)
    result = StripeUsageGateway(service, operation, token).run()
    assert result["payment_status"] == "paid"
    assert sum(line.amount for line in lines) == (120000 if cancelled else 456000)
    assert remote.Invoice.create.call_count == int(cancelled)
    assert StripeUsageGateway(service, operation, token).run()["invoice_id"] == invoice.id
    assert remote.InvoiceItem.create.call_count == 12
    remote.Invoice.pay.assert_called_once()
