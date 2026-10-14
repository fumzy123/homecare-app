"""Read-only verification of the credentials actually injected into the backend.

Reports identifiers and validation results only; never keys or Stripe responses.
"""
import os
import stripe
from app.core.config import settings
from app.core.stripe_objects import stripe_field as field


def verify_billing_configuration(config=settings, client=None):
    environment = os.getenv("RAILWAY_ENVIRONMENT_NAME") or config.app_env
    expected_live = environment == "production"
    result = {"environment": environment, "expected_livemode": expected_live,
              "expected_account": config.stripe_account_id, "checks": {}, "errors": []}
    key = config.stripe_secret_key
    if not key.startswith(("sk_live_", "rk_live_") if expected_live else ("sk_test_", "rk_test_")):
        result["errors"].append("STRIPE_KEY_MODE_MISMATCH")
        return result
    client = client or stripe.StripeClient(key, max_network_retries=1)
    try:
        account = client.v1.accounts.retrieve_current()
        result["account"] = account.id
        if not config.stripe_account_id or account.id != config.stripe_account_id:
            result["errors"].append("STRIPE_ACCOUNT_MISMATCH")
            return result
        prices = (
            ("standard_monthly", config.stripe_standard_monthly_price_id, 35000, "month"),
            ("standard_annual", config.stripe_standard_annual_price_id, 336000, "year"),
            ("founding_monthly", config.stripe_founding_monthly_price_id, 20000, "month"),
        )
        for name, price_id, amount, interval in prices:
            if not price_id:
                result["errors"].append(f"MISSING_{name.upper()}_PRICE")
                continue
            price = client.v1.prices.retrieve(price_id)
            recurring = field(price, "recurring", {})
            valid = (price.active and price.livemode == expected_live and price.currency == "cad"
                     and price.unit_amount == amount and field(recurring, "interval") == interval
                     and field(recurring, "interval_count") == 1)
            result["checks"][name] = {"id": price.id, "livemode": price.livemode, "valid": valid}
            if not valid:
                result["errors"].append(f"INVALID_{name.upper()}_PRICE")
        for code, amount in (("standard", 1000), ("founding", 500)):
            name = f"{code}_additional_client"
            price_id = getattr(config, f"stripe_{name}_price_id", "")
            if not price_id:
                result["errors"].append(f"MISSING_{name.upper()}_PRICE")
                continue
            price = client.v1.prices.retrieve(price_id, {"expand": ["product"]})
            valid = (price.active and price.livemode == expected_live and price.currency == "cad"
                     and price.unit_amount == amount and field(price, "type") == "one_time"
                     and field(price, "tax_behavior") == "exclusive"
                     and field(field(field(price, "product", {}), "metadata", {}), "care_harbor_component") == "additional_client_usage")
            result["checks"][name] = {"id": price.id, "livemode": price.livemode, "valid": valid}
            if not valid:
                result["errors"].append(f"INVALID_{name.upper()}_PRICE")
        result["webhook_secret_configured"] = bool(config.stripe_webhook_secret)
        # Presence is not proof of a matching signature. A signed delivery is a separate gate.
        if not config.stripe_webhook_secret:
            result["errors"].append("MISSING_WEBHOOK_SECRET")
    except stripe.StripeError:
        result["errors"].append("STRIPE_VERIFICATION_REQUEST_FAILED")
    return result


def log_billing_configuration():
    import json
    import logging
    try:
        result = verify_billing_configuration()
    except Exception:
        result = {"errors": ["BILLING_CONFIGURATION_CHECK_FAILED"]}
    logging.getLogger("uvicorn.error").info("BILLING_CONFIGURATION %s", json.dumps(result))
