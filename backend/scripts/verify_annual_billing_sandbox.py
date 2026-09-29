"""Exercise the real annual Stripe invoice using a disposable test clock.

Application records live in an isolated in-memory database. No agency data is read.
"""
import sys
import time
from pathlib import Path
from datetime import datetime, timedelta, timezone
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import stripe  # noqa: E402
from dateutil.relativedelta import relativedelta  # noqa: E402
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
from app.services.billing_annual_service import BillingAnnualService  # noqa: E402
from app.services.billing_invoice_hold_service import BillingInvoiceHoldService  # noqa: E402
from app.services.stripe_usage_gateway import StripeUsageGateway  # noqa: E402


def advance(clock, when):
    stripe.test_helpers.TestClock.advance(clock.id, frozen_time=int(when.timestamp()))
    for _ in range(90):
        if stripe.test_helpers.TestClock.retrieve(clock.id).status == 'ready':
            return
        time.sleep(1)
    raise RuntimeError('Test clock did not settle')


def verify(cancel):
    start = datetime.now(timezone.utc).replace(microsecond=0)
    end = start + relativedelta(years=1)
    clock = stripe.test_helpers.TestClock.create(frozen_time=int(start.timestamp()), name='Care Harbor annual verification')
    try:
        customer = stripe.Customer.create(test_clock=clock.id, name='Annual billing disposable test')
        pm = stripe.PaymentMethod.attach('pm_card_visa', customer=customer.id)
        stripe.Customer.modify(customer.id, invoice_settings={'default_payment_method': pm.id})
        sub = stripe.Subscription.create(customer=customer.id, default_payment_method=pm.id,
            items=[{'price': settings.stripe_standard_annual_v2_price_id}])
        original = stripe.Invoice.retrieve(sub.latest_invoice)
        assert original.status == 'paid' and original.total == 336000
        base = list(stripe.Invoice.list_lines(original.id).auto_paging_iter())[0]
        if cancel:
            stripe.Subscription.modify(sub.id, cancel_at_period_end=True)
        engine = create_engine('sqlite://')
        for model in (Organization, BillingAgreement, FoundingConversion, BillingPeriod,
                      BillingUsageSnapshot, BillingAdjustment, BillingSettlement, BillingInvoiceHold):
            model.__table__.create(engine)
        with Session(engine, autoflush=False) as db:
            org = Organization(id=uuid4(), name='Sandbox', owner_id=uuid4(), stripe_customer_id=customer.id,
                subscription_id=sub.id, trial_ends_at=start, onboarding_deadline_at=start)
            db.add(org)
            db.add(BillingAgreement(org_id=org.id, plan_code='standard', plan_version=2, base_interval='year',
                stripe_price_id=settings.stripe_standard_annual_v2_price_id, accepted_by=org.owner_id,
                consent_version='sandbox', accepted_at=start))
            ids = []
            for index in range(12):
                a, b = start + relativedelta(months=index), start + relativedelta(months=index+1)
                pid = uuid4()
                ids.append(pid)
                terms = dict(subscription_id=sub.id, starts_at=a.isoformat(), ends_at=b.isoformat(),
                    base_interval='year', plan_version=2, additional_client_amount_cents=500, currency='cad')
                db.add(BillingPeriod(id=pid, org_id=org.id, subscription_id=sub.id, starts_at=a, ends_at=b,
                    source_invoice_id=original.id, source_invoice_line_id=base.id, anchor_at=start, agency_timezone='UTC',
                    plan_code='standard', plan_version=2, base_interval='year', included_clients=10,
                    additional_client_amount_cents=500, currency='cad', finalization_eligible_at=b+timedelta(hours=72)))
                db.add(BillingUsageSnapshot(period_id=pid, org_id=org.id, finalized_at=b+timedelta(hours=72),
                    active_client_count=30, additional_clients=20, usage_amount_cents=10000, payload={'period': terms}))
            db.commit()
            service = BillingAnnualService(db)
            for pid in ids:
                service.prepare(org.id, pid)
            assert service.settlement_repo.work_ids() == []
            advance(clock, end)
            if not cancel:
                drafts = list(stripe.Invoice.list(customer=customer.id, status='draft').auto_paging_iter())
                assert len(drafts) == 1
                BillingInvoiceHoldService(db).hold(drafts[0].id)
                assert stripe.Invoice.retrieve(drafts[0].id).auto_advance is False
            advance(clock, end+timedelta(hours=72))
            service.prepare_year(org.id, original.id, base.id, now=end+timedelta(hours=72))
            batch = service.settlement_repo.by_source(f'annual:{original.id}:{base.id}')
            op, token = service.claim(batch.id)
            gateway = StripeUsageGateway(service, op, token)
            result = gateway.run()
            assert gateway.run()['invoice_id'] == result['invoice_id']
            service.finish(batch.id, token, **result)
            invoice = stripe.Invoice.retrieve(result['invoice_id'])
            assert invoice.status == 'paid' and invoice.total == (120000 if cancel else 456000)
            assert len(list(stripe.Invoice.list_lines(invoice.id, limit=100).auto_paging_iter())) == (12 if cancel else 13)
            assert len(list(stripe.Invoice.list(customer=customer.id).auto_paging_iter())) == 2
            print(f'Annual {"cancellation" if cancel else "renewal"}: one invoice, 12 usage lines, exact amount, retry safe', flush=True)
        engine.dispose()
    finally:
        stripe.test_helpers.TestClock.delete(clock.id)


if __name__ == '__main__':
    if not settings.stripe_secret_key.startswith(('sk_test_', 'rk_test_')):
        raise SystemExit('Test key required; no requests sent')
    stripe.api_key = settings.stripe_secret_key
    settings.billing_onboarding_enabled = settings.billing_settlement_enabled = True
    settings.billing_settlement_live_enabled = False
    settings.billing_usage_tax_mode = 'none'
    try:
        verify(False)
        verify(True)
    except Exception as exc:
        print(f'Annual sandbox verification failed: {type(exc).__name__}: {getattr(exc, "user_message", None) or str(exc)}')
        raise SystemExit(1)
