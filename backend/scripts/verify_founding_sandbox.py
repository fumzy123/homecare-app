"""Verify a zero-charge trial using the configured current Founding sandbox price."""
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
        raise SystemExit("Sandbox key required")
    stripe.api_key = key
    price = stripe.Price.retrieve(config["STRIPE_FOUNDING_MONTHLY_V2_PRICE_ID"])
    assert not price.livemode and price.active and price.currency == "cad" and price.unit_amount == 20000
    assert price.recurring.interval == "month" and price.recurring.interval_count == 1
    customer = stripe.Customer.create(name="Founding sandbox verification")
    subscription = None
    try:
        intent = stripe.SetupIntent.create(customer=customer.id, payment_method="pm_card_visa", confirm=True,
                                           usage="off_session", payment_method_types=["card"])
        params = dict(customer=customer.id, items=[{"price": price.id}], default_payment_method=intent.payment_method,
                      trial_end=int((datetime.now(timezone.utc) + timedelta(days=14)).timestamp()),
                      idempotency_key=f"founding-smoke-{uuid4()}")
        subscription = stripe.Subscription.create(**params)
        retry = stripe.Subscription.create(**params)
        invoice = stripe.Invoice.retrieve(subscription.latest_invoice)
        assert subscription.status == "trialing" and retry.id == subscription.id and invoice.amount_due == 0
        print(json.dumps({"sandbox_only": True, "founding_price_id": price.id, "base_cents": 20000,
                          "trial_invoice_cents": invoice.amount_due, "duplicate_retry": "passed"}))
    finally:
        if subscription:
            stripe.Subscription.cancel(subscription.id)
        stripe.Customer.delete(customer.id)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("Founding sandbox verification failed: " + type(error).__name__)
        raise SystemExit(1)
