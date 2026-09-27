"""Exercise the real conversion service in Stripe test mode, without an app DB.

Simulate the final two protected months; domain tests cover the 12-month clock.
Disposable test-clock customers are always deleted. No live keys are accepted.
"""
from pathlib import Path
import sys
import time
import json
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

from dateutil.relativedelta import relativedelta
from dotenv import dotenv_values
import stripe

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.core.config import settings  # noqa: E402
from app.services.founding_conversion_service import FoundingConversionService, release_conversion_schedule  # noqa: E402
from verify_trial_conversion_sandbox import advance  # noqa: E402


def service_for(sub, customer, end):
    svc = FoundingConversionService(MagicMock())
    for name in ("trial_activation_repo", "agreement_repo", "founding_offer_repo", "conversion_repo", "notification_repo"):
        setattr(svc, name, MagicMock())
    org = SimpleNamespace(id=uuid4(), subscription_id=sub.id, stripe_customer_id=customer.id,
                          onboarding_deadline_at=end - timedelta(days=365))
    svc.trial_activation_repo.lock_organization.return_value = org
    svc.agreement_repo.get_for_org.return_value = SimpleNamespace(
        plan_code="founding", stripe_price_id=settings.stripe_founding_monthly_v1_price_id, canceled_at=None)
    svc.founding_offer_repo.get_for_org.return_value = SimpleNamespace(
        protection_ends_at=end, released_at=None, forfeited_at=None)
    svc.conversion_repo.get_for_org.return_value = None
    svc.conversion_repo.add.side_effect = lambda c: setattr(svc.conversion_repo.get_for_org, "return_value", c)
    return svc, org


def main():
    config = dotenv_values(Path(__file__).resolve().parents[1] / ".env.local")
    key = config.get("STRIPE_SECRET_KEY", "")
    if not key.startswith(("sk_test_", "rk_test_")):
        raise SystemExit("Sandbox key required")
    stripe.api_key = key
    settings.billing_onboarding_enabled = True  # This process only; no file changes.
    settings.stripe_standard_monthly_v1_price_id = config["STRIPE_STANDARD_MONTHLY_V1_PRICE_ID"]
    settings.stripe_founding_monthly_v1_price_id = config["STRIPE_FOUNDING_MONTHLY_V1_PRICE_ID"]
    start = datetime.fromtimestamp(int(time.time()), timezone.utc)
    end = start + relativedelta(months=2)
    clock = stripe.test_helpers.TestClock.create(frozen_time=int(start.timestamp()), name="Founding price transition verification")
    try:
        cases = []
        for cancel in (False, True):
            customer = stripe.Customer.create(test_clock=clock.id, name="Disposable founding transition test")
            intent = stripe.SetupIntent.create(customer=customer.id, payment_method="pm_card_visa", confirm=True,
                                               usage="off_session", payment_method_types=["card"])
            sub = stripe.Subscription.create(customer=customer.id, items=[{"price": settings.stripe_founding_monthly_v1_price_id}],
                                             default_payment_method=intent.payment_method)
            svc, org = service_for(sub, customer, end)
            cases.append((cancel, svc, org, sub.id, customer.id))
        notice = start + timedelta(days=20)
        advance(clock.id, int(notice.timestamp()))
        for cancel, svc, org, sub_id, _ in cases:
            svc.process(org.id, now=notice)
            conversion = svc.conversion_repo.get_for_org.return_value
            assert conversion.status == "scheduled" and conversion.effective_at == end
            svc.process(org.id, now=notice)  # Real Stripe schedule reconciliation.
            assert conversion.status == "scheduled"
            svc.notification_repo.create.assert_called_once()
            if cancel:
                release_conversion_schedule(conversion, stripe.Subscription.retrieve(sub_id))
                stripe.Subscription.modify(sub_id, cancel_at_period_end=True)
        print("Scheduled transition and cancellation verified; advancing protected renewal", flush=True)
        advance(clock.id, int((start + relativedelta(months=1) + timedelta(days=3)).timestamp()))
        for cancel, _, _, sub_id, customer_id in cases:
            sub = stripe.Subscription.retrieve(sub_id)
            paid = sum(i.amount_paid for i in stripe.Invoice.list(customer=customer_id, limit=10).data)
            assert paid == (20000 if cancel else 40000), f"Protected period total: {paid}"
            assert sub.status == ("canceled" if cancel else "active")
        print("Protected renewal stayed CAD 200; advancing Standard transition", flush=True)
        advance(clock.id, int((end + timedelta(days=3)).timestamp()))
        for cancel, svc, org, sub_id, customer_id in cases:
            paid = sum(i.amount_paid for i in stripe.Invoice.list(customer=customer_id, limit=10).data)
            assert paid == (20000 if cancel else 70000), f"Final total: {paid}"
            if not cancel:
                svc.process(org.id, now=end + timedelta(days=3))
                assert svc.conversion_repo.get_for_org.return_value.status == "converted"
                # Cancellation must also work during the final Standard phase.
                release_conversion_schedule(svc.conversion_repo.get_for_org.return_value, stripe.Subscription.retrieve(sub_id))
                stripe.Subscription.modify(sub_id, cancel_at_period_end=True)
        print(json.dumps({"sandbox_only": True, "protected_renewal_cents": 20000, "standard_renewal_cents": 30000,
                          "duplicate_notice": "prevented", "cancellation_before_and_after_transition": "passed"}), flush=True)
    finally:
        stripe.test_helpers.TestClock.delete(clock.id)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("Founding transition verification failed: " + type(error).__name__, flush=True)
        if isinstance(error, AssertionError):
            print(str(error), flush=True)
        raise SystemExit(1)
