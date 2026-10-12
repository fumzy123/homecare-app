"""Exercise real Stripe with in-memory repositories, never application records."""
import sys
from pathlib import Path
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace as NS
from unittest.mock import MagicMock
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import stripe  # noqa: E402
from app.core.config import settings  # noqa: E402
from app.services.billing_onboarding_service import BillingOnboardingService  # noqa: E402


def main():
    if not settings.stripe_secret_key.startswith(('sk_test_', 'rk_test_')):
        raise SystemExit('Sandbox key required; no requests sent')
    stripe.api_key = settings.stripe_secret_key
    settings.billing_onboarding_enabled = True  # This process only.
    for name, price, hours, amount in [
        ('monthly_expired', settings.stripe_standard_monthly_v1_price_id, -24, 30000),
        ('annual_expired', settings.stripe_standard_annual_v1_price_id, -24, 300000),
        ('two_hours_remaining', settings.stripe_standard_monthly_v1_price_id, 2, 0),
    ]:
        customer = stripe.Customer.create(name='Care Harbor self-service sandbox verification')
        try:
            intent = stripe.SetupIntent.create(customer=customer.id, payment_method='pm_card_visa',
                confirm=True, usage='off_session', payment_method_types=['card'])
            now = datetime.now(timezone.utc).replace(microsecond=0)
            org = NS(id=uuid4(), stripe_customer_id=customer.id, subscription_id=None,
                onboarding_deadline_at=now - timedelta(days=20), billing_timezone='UTC')
            request = NS(id=uuid4(), starts_at=now - timedelta(days=14),
                ends_at=now + timedelta(hours=hours), status='pending', source='purchase', stripe_attempted_at=None)
            agreement = NS(id=uuid4(), plan_code='standard', stripe_price_id=price,
                payment_method_id=intent.payment_method, canceled_at=None)
            service = BillingOnboardingService(MagicMock(), org_id=org.id)
            service.trial_activation_repo = MagicMock()
            service.trial_activation_repo.lock_organization.return_value = org
            service.trial_activation_repo.get_for_org.return_value = request
            service.agreement_repo = MagicMock()
            service.agreement_repo.get_for_org.return_value = agreement
            service.process_activation(now=now)
            service.process_activation(now=now)
            subs = list(stripe.Subscription.list(customer=customer.id, status='all').auto_paging_iter())
            assert len(subs) == 1
            sub = subs[0]
            invoice = stripe.Invoice.retrieve(sub.latest_invoice)
            assert invoice.amount_due == amount
            if hours > 0:
                assert sub.trial_end == int(request.ends_at.timestamp()) and sub.status == 'trialing'
            else:
                assert sub.trial_end is None
                assert org.trial_ends_at.timestamp() == sub.start_date
                if invoice.status != 'paid':
                    assert invoice.hosted_invoice_url and sub.status == 'incomplete'
                    invoice = stripe.Invoice.pay(invoice.id, payment_method=intent.payment_method)
                assert invoice.amount_paid == amount
                assert stripe.Subscription.retrieve(sub.id).status == 'active'
            print(f'{name}: passed (one subscription, invoice CAD cents={amount})', flush=True)
        finally:
            for sub in stripe.Subscription.list(customer=customer.id, status='all').auto_paging_iter():
                if sub.status not in ('canceled', 'incomplete_expired'):
                    stripe.Subscription.cancel(sub.id)
            stripe.Customer.delete(customer.id)


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print('Sandbox verification failed: ' + type(exc).__name__)
        raise SystemExit(1)
