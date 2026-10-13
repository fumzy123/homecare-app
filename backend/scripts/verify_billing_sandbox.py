"""Smoke-test setup/trial/cancel using the configured current sandbox prices.

Never accepts a live key. Does not enable rollout or modify application records.
Run from backend: .venv/Scripts/python scripts/verify_billing_sandbox.py
"""
from pathlib import Path
from datetime import datetime, timedelta, timezone
from uuid import uuid4
import json
import stripe
from dotenv import dotenv_values


def main():
    env = Path(__file__).resolve().parents[1] / ".env.local"
    config = dotenv_values(env)
    key = config.get("STRIPE_SECRET_KEY", "")
    if not key.startswith(("sk_test_", "rk_test_")):
        raise SystemExit("A sandbox key is required; no requests sent")
    stripe.api_key = key
    stripe.max_network_retries = 2
    prices = {}
    for interval, amount, env_name in (
        ("month", 35000, "STRIPE_STANDARD_MONTHLY_PRICE_ID"),
        ("year", 336000, "STRIPE_STANDARD_ANNUAL_PRICE_ID"),
    ):
        price = stripe.Price.retrieve(config[env_name])
        assert not price.livemode and price.active and price.currency == "cad" and price.unit_amount == amount
        assert price.recurring.interval == interval and price.recurring.interval_count == 1
        prices[interval] = price.id
    results = []
    for interval, price_id in prices.items():
        customer = None
        subscription = None
        session = None
        try:
            customer = stripe.Customer.create(name="Care Harbor automated sandbox verification", metadata={"purpose": "billing-smoke-test"})
            session = stripe.checkout.Session.create(
                mode="setup", customer=customer.id, currency="cad", payment_method_types=["card"],
                success_url="http://localhost:5173/settings/billing", cancel_url="http://localhost:5173/settings/billing",
            )
            assert session.mode == "setup" and not session.livemode
            # API test card exercises off-session setup separately from hosted UI.
            intent = stripe.SetupIntent.create(
                customer=customer.id, payment_method="pm_card_visa", confirm=True,
                usage="off_session", payment_method_types=["card"],
            )
            assert intent.status == "succeeded"
            end = int((datetime.now(timezone.utc) + timedelta(days=14)).timestamp())
            args = dict(
                customer=customer.id, items=[{"price": price_id}],
                default_payment_method=intent.payment_method, trial_end=end,
                trial_settings={"end_behavior": {"missing_payment_method": "cancel"}},
                idempotency_key=f"smoke-{uuid4()}",
            )
            subscription = stripe.Subscription.create(**args)
            again = stripe.Subscription.create(**args)
            assert subscription.id == again.id and subscription.status == "trialing"
            assert subscription.trial_end == end
            invoice = stripe.Invoice.retrieve(subscription.latest_invoice)
            assert invoice.amount_due == 0 and invoice.amount_paid == 0
            canceled = stripe.Subscription.modify(subscription.id, cancel_at_period_end=True)
            assert canceled.cancel_at_period_end and canceled.status == "trialing"
            results.append({"interval": interval, "card_setup": "passed", "trial": "passed", "duplicate_retry": "passed", "cancel_before_conversion": "passed", "initial_invoice_cents": invoice.amount_due})
        finally:
            if subscription:
                stripe.Subscription.cancel(subscription.id)
            if session and session.status == "open":
                stripe.checkout.Session.expire(session.id)
            if customer:
                stripe.Customer.delete(customer.id)
    print(json.dumps({"sandbox_only": True, "price_ids": prices, "checks": results}))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # Avoid rendering arbitrary remote error payloads or secrets.
        print("Sandbox verification failed: " + type(error).__name__)
        raise SystemExit(1)
