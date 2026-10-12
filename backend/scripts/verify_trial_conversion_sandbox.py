"""Advance a disposable Stripe test clock through monthly/annual conversion."""
from pathlib import Path
import time
import json
import stripe
from dotenv import dotenv_values


def advance(clock_id, timestamp):
    stripe.test_helpers.TestClock.advance(clock_id, frozen_time=timestamp)
    for _ in range(40):
        state = stripe.test_helpers.TestClock.retrieve(clock_id)
        if state.status == "ready":
            return
        if state.status == "internal_failure":
            raise RuntimeError("Stripe test clock failed")
        time.sleep(2)
    raise RuntimeError("Stripe test clock did not finish in time")


def main():
    config = dotenv_values(Path(__file__).resolve().parents[1] / ".env.local")
    key = config.get("STRIPE_SECRET_KEY", "")
    if not key.startswith(("sk_test_", "rk_test_")):
        raise SystemExit("Sandbox key required")
    stripe.api_key = key
    start = int(time.time())
    clock = stripe.test_helpers.TestClock.create(frozen_time=start, name="Care Harbor trial conversion verification")
    try:
        cases = []
        for name, price_id, amount in (
            ("monthly", config["STRIPE_STANDARD_MONTHLY_V1_PRICE_ID"], 30000),
            ("annual", config["STRIPE_STANDARD_ANNUAL_V1_PRICE_ID"], 300000),
            ("cancel_before_conversion", config["STRIPE_STANDARD_MONTHLY_V1_PRICE_ID"], 0),
        ):
            customer = stripe.Customer.create(test_clock=clock.id, name="Automated sandbox trial test")
            intent = stripe.SetupIntent.create(customer=customer.id, payment_method="pm_card_visa", confirm=True, usage="off_session", payment_method_types=["card"])
            sub = stripe.Subscription.create(customer=customer.id, items=[{"price": price_id}], default_payment_method=intent.payment_method, trial_end=start + 14 * 86400)
            if amount == 0:
                stripe.Subscription.modify(sub.id, cancel_at_period_end=True)
            cases.append((name, sub.id, customer.id, amount))
        print("Advancing sandbox subscriptions past trial end", flush=True)
        advance(clock.id, start + 14 * 86400 + 3600)
        print("Advancing past invoice collection window", flush=True)
        advance(clock.id, start + 18 * 86400)
        results = []
        for name, sub_id, customer_id, expected in cases:
            sub = stripe.Subscription.retrieve(sub_id)
            paid = sum(invoice.amount_paid for invoice in stripe.Invoice.list(customer=customer_id, limit=10).data)
            assert paid == expected, f"{name}: unexpected total {paid}"
            assert sub.status == ("canceled" if expected == 0 else "active"), f"{name}: {sub.status}"
            results.append({"scenario": name, "status": sub.status, "paid_cents": paid})
        print(json.dumps({"sandbox_only": True, "results": results}), flush=True)
    finally:
        stripe.test_helpers.TestClock.delete(clock.id)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("Conversion verification failed: " + type(error).__name__, flush=True)
        if isinstance(error, AssertionError):
            print(str(error), flush=True)
        raise SystemExit(1)
