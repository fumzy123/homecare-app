"""Exercise the actual settlement services against disposable Stripe test clocks.

No application database or live key is accepted. SQLite is process-local only.
"""
from pathlib import Path
import sys
import time
import json
from datetime import datetime, timedelta, timezone
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import stripe  # noqa: E402
from dotenv import dotenv_values  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402
from app.core.config import settings  # noqa: E402
from app.models.organization import Organization  # noqa: E402
from app.models.billing_agreement import BillingAgreement  # noqa: E402
from app.models.founding_conversion import FoundingConversion  # noqa: E402
from app.models.billing_period import BillingPeriod  # noqa: E402
from app.models.billing_usage_snapshot import BillingUsageSnapshot  # noqa: E402
from app.models.billing_adjustment import BillingAdjustment  # noqa: E402
from app.models.billing_settlement import BillingSettlement, BillingInvoiceHold  # noqa: E402
from app.services.billing_settlement_service import BillingSettlementService  # noqa: E402
from app.services.billing_invoice_hold_service import BillingInvoiceHoldService  # noqa: E402
from app.services.stripe_usage_gateway import StripeUsageGateway  # noqa: E402
from verify_trial_conversion_sandbox import advance  # noqa: E402


def stamp(value):
    return datetime.fromtimestamp(value, timezone.utc)


def seed_period(db, org_id, sub_id, start, end, interval, amount):
    pid = uuid4()
    terms = dict(subscription_id=sub_id, starts_at=start.isoformat(), ends_at=end.isoformat(), base_interval=interval,
                 included_clients=10, additional_client_amount_cents=500, currency="cad")
    db.add(BillingPeriod(id=pid, org_id=org_id, subscription_id=sub_id, starts_at=start, ends_at=end, anchor_at=start,
        agency_timezone="UTC", plan_code="standard", plan_version=1, base_interval=interval,
        included_clients=10, additional_client_amount_cents=500, currency="cad", finalization_eligible_at=end + timedelta(hours=72)))
    db.add(BillingUsageSnapshot(period_id=pid, org_id=org_id, finalized_at=end + timedelta(hours=72),
        active_client_count=10 + amount // 500, additional_clients=amount // 500, usage_amount_cents=amount,
        payload={"period": terms, "clients": []}))
    db.commit()
    return pid


def execute(db, sid):
    service = BillingSettlementService(db)
    claim = service.claim(sid)
    assert claim is not None
    op, token = claim
    result = StripeUsageGateway(service, op, token).run()
    service.finish(sid, token, **result)
    return result


def main():
    config = dotenv_values(Path(__file__).resolve().parents[1] / ".env.local")
    key = config.get("STRIPE_SECRET_KEY", "")
    if not key.startswith(("sk_test_", "rk_test_")):
        raise SystemExit("Sandbox key required; no requests sent")
    stripe.api_key = key
    stripe.max_network_retries = 2
    settings.billing_onboarding_enabled = settings.billing_settlement_enabled = True
    settings.billing_settlement_live_enabled = False
    settings.billing_usage_tax_mode = "none"
    engine = create_engine("sqlite://")
    for model in (Organization, BillingAgreement, FoundingConversion, BillingPeriod, BillingUsageSnapshot,
                  BillingAdjustment, BillingSettlement, BillingInvoiceHold):
        model.__table__.create(engine)
    start = int(time.time())
    clock = stripe.test_helpers.TestClock.create(frozen_time=start, name="Care Harbor usage settlement verification")
    try:
        with Session(engine, autoflush=False) as db:
            results = []
            customers = {}
            for interval in ("month", "year"):
                customer = stripe.Customer.create(test_clock=clock.id, name="Sandbox usage verification")
                intent = stripe.SetupIntent.create(customer=customer.id, payment_method="pm_card_visa", confirm=True,
                    usage="off_session", payment_method_types=["card"])
                stripe.Customer.modify(customer.id, invoice_settings={"default_payment_method": intent.payment_method})
                price = config["STRIPE_STANDARD_MONTHLY_V1_PRICE_ID" if interval == "month" else "STRIPE_STANDARD_ANNUAL_V1_PRICE_ID"]
                sub = stripe.Subscription.create(customer=customer.id, items=[{"price": price}],
                    default_payment_method=intent.payment_method, trial_end=start + 14 * 86400)
                org_id = uuid4()
                db.add(Organization(id=org_id, name="Sandbox", owner_id=uuid4(), stripe_customer_id=customer.id,
                    subscription_id=sub.id, onboarding_deadline_at=stamp(start), trial_ends_at=stamp(sub.trial_end)))
                db.add(BillingAgreement(org_id=org_id, plan_code="standard", plan_version=1, base_interval=interval,
                    stripe_price_id=price, consent_version="sandbox", accepted_at=stamp(start), accepted_by=uuid4()))
                db.commit()
                customers[interval] = (org_id, customer.id, sub.id)
            print("Advancing sandbox clock through initial trial conversion", flush=True)
            advance(clock.id, start + 18 * 86400)
            monthly = stripe.Subscription.retrieve(customers["month"][2])
            boundary = monthly["items"].data[0].current_period_end
            print("Advancing to monthly renewal and holding its draft", flush=True)
            advance(clock.id, boundary)
            monthly = stripe.Subscription.retrieve(monthly.id)
            renewal = stripe.Invoice.retrieve(monthly.latest_invoice)
            assert renewal.status == "draft", "Expected renewal draft before collection"
            BillingInvoiceHoldService(db).hold(renewal.id)
            assert stripe.Invoice.retrieve(renewal.id).auto_advance is False
            advance(clock.id, boundary + 3 * 86400)
            assert stripe.Invoice.retrieve(renewal.id).status == "draft"
            for interval, (org_id, customer_id, sub_id) in customers.items():
                pid = seed_period(db, org_id, sub_id, stamp(start + 14 * 86400), stamp(boundary), interval, 10000)
                BillingSettlementService(db).prepare(org_id, pid)
                sid = db.query(BillingSettlement.id).filter(BillingSettlement.period_id == pid).scalar()
                db.commit()
                result = execute(db, sid)
                invoice = stripe.Invoice.retrieve(result["invoice_id"])
                assert result["payment_status"] == "paid"
                assert invoice.amount_paid == (40000 if interval == "month" else 10000)
                assert invoice.id == renewal.id if interval == "month" else invoice.id != renewal.id
                # A replay never creates another invoice or invoice item.
                before = len(list(stripe.Invoice.list(customer=customer_id, limit=100).auto_paging_iter()))
                assert execute(db, sid) == result
                assert len(list(stripe.Invoice.list(customer=customer_id, limit=100).auto_paging_iter())) == before
                aid = uuid4()
                db.add(BillingAdjustment(id=aid, org_id=org_id, period_id=pid, request_id=uuid4(),
                    baseline_sequence=0, approval_sequence=1, status="approved", amount_cents=-500, currency="cad",
                    reason="Sandbox correction", proposed_by=uuid4(), proposed_at=stamp(boundary), settlement_status="pending", payload={}))
                db.commit()
                BillingSettlementService(db).prepare(org_id, pid)
                credit_sid = db.query(BillingSettlement.id).filter(BillingSettlement.adjustment_id == aid).scalar()
                db.commit()
                credit_result = execute(db, credit_sid)
                assert credit_result["state"] == "credited"
                assert execute(db, credit_sid) == credit_result
                credits = list(stripe.CreditNote.list(invoice=invoice.id, limit=100).auto_paging_iter())
                assert len(credits) == 1 and credits[0].amount == 500 and credits[0].post_payment_amount == 500
                results.append(dict(interval=interval, paid_cents=invoice.amount_paid,
                                    refund_cents=credits[0].post_payment_amount, replay="passed"))
            print(json.dumps({"sandbox_only": True, "checks": results}), flush=True)
    finally:
        stripe.test_helpers.TestClock.delete(clock.id)
        engine.dispose()


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("Usage settlement verification failed: " + type(error).__name__, flush=True)
        import traceback
        for frame in traceback.extract_tb(error.__traceback__):
            print(f"{Path(frame.filename).name}:{frame.lineno} in {frame.name}", flush=True)
        if isinstance(error, (TypeError, AttributeError, KeyError)):
            print(str(error), flush=True)
        if isinstance(error, AssertionError):
            print(str(error), flush=True)
        elif isinstance(error, stripe.InvalidRequestError):
            print("Stripe parameter: " + str(error.param) + "; code: " + str(error.code), flush=True)
        raise SystemExit(1)
