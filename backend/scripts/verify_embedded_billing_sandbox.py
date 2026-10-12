"""Verify real Stripe APIs using disposable test customers, no application DB."""
import sys
from pathlib import Path
from datetime import datetime, timezone, timedelta
from types import SimpleNamespace as NS
from unittest.mock import MagicMock
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import stripe  # noqa: E402
from app.core.config import settings  # noqa: E402
from app.services.billing_plan_service import BillingPlanService  # noqa: E402


def main():
    if not settings.stripe_secret_key.startswith(('sk_test_', 'rk_test_')):
        raise SystemExit('Test key required; no requests sent')
    stripe.api_key = settings.stripe_secret_key
    for trial in (True, False):
        customer = stripe.Customer.create(name='Care Harbor embedded billing verification')
        try:
            checkout = stripe.checkout.Session.create(customer=customer.id, mode='setup', currency='cad',
                ui_mode='embedded_page', redirect_on_completion='never', payment_method_types=['card'])
            assert checkout.client_secret and not checkout.url
            stripe.checkout.Session.expire(checkout.id)
            intent = stripe.SetupIntent.create(customer=customer.id, payment_method='pm_card_visa',
                confirm=True, usage='off_session', payment_method_types=['card'])
            now = datetime.now(timezone.utc)
            trial_end = int((now + timedelta(days=7)).timestamp())
            sub = stripe.Subscription.create(customer=customer.id,
                items=[{'price': settings.stripe_standard_monthly_v2_price_id}],
                default_payment_method=intent.payment_method,
                **({'trial_end': trial_end} if trial else {}))
            service = BillingPlanService(MagicMock(), NS(id=uuid4()), uuid4())
            service.org_repo = MagicMock()
            service.agreement_repo = MagicMock()
            service.org_repo.lock_by_id.return_value = NS(id=service.org_id, stripe_customer_id=customer.id,
                subscription_id=sub.id, trial_ends_at=None)
            service.agreement_repo.get_for_org.return_value = NS(plan_code='standard', base_interval='month',
                stripe_price_id=settings.stripe_standard_monthly_v2_price_id, canceled_at=None)
            quote = service.preview('year')
            service.change(quote)
            service.change(quote)  # Retry must not duplicate a charge or schedule.
            updated = stripe.Subscription.retrieve(sub.id)
            if trial:
                assert updated.trial_end == trial_end and updated.status == 'trialing'
                assert updated['items'].data[0].price.id == settings.stripe_standard_annual_v2_price_id
            else:
                schedule = stripe.SubscriptionSchedule.retrieve(updated.schedule)
                assert schedule.phases[1].start_date == quote['effective_at']
                assert schedule.phases[1]['items'][0].price == settings.stripe_standard_annual_v2_price_id
                assert updated['items'].data[0].price.id == settings.stripe_standard_monthly_v2_price_id
            print(f'Embedded setup + {"trial" if trial else "paid renewal"} plan change: passed', flush=True)
        finally:
            for sub in stripe.Subscription.list(customer=customer.id, status='all').auto_paging_iter():
                if sub.status not in ('canceled', 'incomplete_expired'):
                    if sub.schedule:
                        stripe.SubscriptionSchedule.release(sub.schedule)
                    stripe.Subscription.cancel(sub.id)
            stripe.Customer.delete(customer.id)


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print(f'Sandbox verification failed: {type(exc).__name__}: {getattr(exc, "user_message", None) or "see API compatibility"}')
        raise SystemExit(1)
