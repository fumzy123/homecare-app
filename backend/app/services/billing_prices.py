"""Resolve the three supported Stripe prices; never substitute retired prices."""
from app.core.config import settings
from app.domain.billing import current_plan_version


def price_id(code, interval, version):
    if isinstance(version, bool) or not isinstance(version, int) or version != current_plan_version(code):
        raise ValueError("Unsupported configured price")
    if code == "founding" and interval == "month":
        return getattr(settings, f"stripe_founding_monthly_v{version}_price_id")
    if code != "standard" or interval not in ("month", "year"):
        raise ValueError("Unsupported configured price")
    cadence = "monthly" if interval == "month" else "annual"
    return getattr(settings, f"stripe_standard_{cadence}_v{version}_price_id")


def standard_prices():
    version = current_plan_version("standard")
    return {value: (interval, version) for interval in ("month", "year")
            if (value := price_id("standard", interval, version))}
