"""Check Jan-31 monthly/annual usage boundaries against real Stripe test clocks."""
from pathlib import Path
import sys
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4
import json
import stripe
from dotenv import dotenv_values

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.core.config import settings  # noqa: E402
from app.services.billing_usage_service import BillingUsageService  # noqa: E402
from verify_trial_conversion_sandbox import advance  # noqa: E402


def instant(month, day):
    return datetime(2026, month, day, 12, tzinfo=timezone.utc)


def main():
    config = dotenv_values(Path(__file__).resolve().parents[1] / ".env.local")
    key = config.get("STRIPE_SECRET_KEY", "")
    if not key.startswith(("sk_test_", "rk_test_")):
        raise SystemExit("Sandbox key required")
    stripe.api_key = key
    settings.billing_onboarding_enabled = True  # In-memory only.
    anchor = instant(1, 31)
    clock = stripe.test_helpers.TestClock.create(frozen_time=int(instant(1, 17).timestamp()), name="Monthly usage boundary verification")
    try:
        cases = []
        for interval, price in (("month", config["STRIPE_STANDARD_MONTHLY_V1_PRICE_ID"]), ("year", config["STRIPE_STANDARD_ANNUAL_V1_PRICE_ID"])):
            customer = stripe.Customer.create(test_clock=clock.id, name="Disposable monthly usage test")
            card = stripe.SetupIntent.create(customer=customer.id, payment_method="pm_card_visa", confirm=True,
                                             usage="off_session", payment_method_types=["card"])
            sub = stripe.Subscription.create(customer=customer.id, items=[{"price": price}],
                                             trial_end=int(anchor.timestamp()), default_payment_method=card.payment_method)
            org_id = uuid4()
            svc = BillingUsageService(MagicMock(), None, org_id)
            for name in ("period_repo", "usage_repo", "trial_activation_repo", "agreement_repo"):
                setattr(svc, name, MagicMock())
            svc.trial_activation_repo.lock_organization.return_value = SimpleNamespace(
                id=org_id, onboarding_deadline_at=instant(1, 17), billing_timezone="America/St_Johns",
                subscription_id=sub.id, stripe_customer_id=customer.id, trial_ends_at=anchor,
            )
            svc.agreement_repo.get_for_org.return_value = SimpleNamespace(
                plan_code="standard", plan_version=1, stripe_price_id=price, base_interval=interval,
            )
            svc.period_repo.get.return_value = None
            svc.usage_repo.candidates.return_value = []
            cases.append((interval, svc))
        results = []
        for now, expected_start, expected_end in (
            (instant(2, 1), anchor, instant(2, 28)),
            (instant(3, 1), instant(2, 28), instant(3, 31)),
            (instant(4, 1), instant(3, 31), instant(4, 30)),
        ):
            print(f"Checking Stripe monthly usage at {now.date()}", flush=True)
            advance(clock.id, int(now.timestamp()))
            for interval, svc in cases:
                result = svc.current(now=now)
                assert result["state"] == "ready"
                assert result["period"]["starts_at"] == expected_start
                assert result["period"]["ends_at"] == expected_end
                assert result["usage"]["estimated_usage_amount_cents"] == 0
                results.append({"base_interval": interval, "start": str(expected_start.date()), "end": str(expected_end.date())})
        print(json.dumps({"sandbox_only": True, "windows": results}), flush=True)
    finally:
        stripe.test_helpers.TestClock.delete(clock.id)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("Usage period verification failed: " + type(error).__name__, flush=True)
        raise SystemExit(1)
