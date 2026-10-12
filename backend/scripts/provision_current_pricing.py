"""Provision current base prices, preserving all existing prices/subscriptions.

Usage: python scripts/provision_current_pricing.py --env-file .env.local --mode test
Additional-client charges remain owned by the app's versioned usage ledger.
"""
import argparse
from pathlib import Path
import sys

from dotenv import dotenv_values, set_key
import stripe

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.domain.billing import current_plan_version, get_plan  # noqa: E402


def provision(env_file, mode):
    config = dotenv_values(env_file)
    key = config.get("STRIPE_SECRET_KEY", "")
    if not key.startswith((f"sk_{mode}_", f"rk_{mode}_")):
        raise ValueError(f"Expected a {mode} key; no requests sent")
    client = stripe.StripeClient(key, max_network_retries=2)
    account = client.v1.accounts.retrieve_current()
    if account.id != "acct_1TTYFVDwdrtTklyu":
        raise ValueError("Unexpected Stripe account; no changes made")
    for code, interval in (("standard", "month"), ("standard", "year"), ("founding", "month")):
        plan = get_plan(code, interval, version=current_plan_version(code))
        lookup = f"care_harbor_{code}_v{plan.version}_{interval}_cad"
        metadata = {"plan_code": code, "plan_version": str(plan.version),
                    "included_clients": str(plan.included_clients), "usage_interval": "month",
                    "additional_client_amount_cents": str(plan.additional_client_amount_cents)}
        if code == "founding":
            metadata.update(protected_months="12", customer_limit="3")
        matches = client.v1.prices.list({"lookup_keys": [lookup], "limit": 2}).data
        if matches:
            price = matches[0]
        else:
            previous = client.v1.prices.list({
                "lookup_keys": [f"care_harbor_{code}_v{plan.version - 1}_{interval}_cad"], "limit": 1,
            }).data
            if not previous:
                raise ValueError(f"Missing existing {code} product; no replacement product created")
            price = client.v1.prices.create({
                "product": previous[0].product, "currency": plan.currency,
                "unit_amount": plan.base_amount_cents, "recurring": {"interval": interval},
                "lookup_key": lookup, "metadata": metadata,
                "nickname": f"{code.title()} v{plan.version}: CAD {plan.base_amount_cents / 100:g}/{interval}; "
                            f"CAD {plan.additional_client_amount_cents / 100:g}/additional client/month",
            }, options={"idempotency_key": lookup})
        if not (price.active and price.livemode == (mode == "live")
                and price.currency == plan.currency and price.unit_amount == plan.base_amount_cents
                and price.recurring.interval == interval and price.recurring.interval_count == 1
                and all(getattr(price.metadata, k, None) == v for k, v in metadata.items())):
            raise ValueError(f"Existing price does not match approved terms: {lookup}")
        cadence = "monthly" if interval == "month" else "annual"
        name = f"STRIPE_{code.upper()}_{cadence.upper()}_V{plan.version}_PRICE_ID"
        set_key(str(env_file), name, price.id)
        print(f"{mode}: {name}={price.id}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", type=Path, required=True)
    parser.add_argument("--mode", choices=("test", "live"), required=True)
    args = parser.parse_args()
    provision(args.env_file, args.mode)
