"""Resolve configured Stripe references without changing historical versions."""
from app.core.config import settings


def price_id(code, interval, version):
    if code == "founding" and interval == "month" and version in (1, 2):
        return getattr(settings, f"stripe_founding_monthly_v{version}_price_id")
    if code != "standard" or version not in (1, 2, 3) or interval not in ("month", "year"):
        raise ValueError("Unsupported configured price")
    cadence = "monthly" if interval == "month" else "annual"
    return getattr(settings, f"stripe_standard_{cadence}_v{version}_price_id")


def standard_prices():
    return {value: (interval, version) for version in (1, 2, 3) for interval in ("month", "year")
            if (value := price_id("standard", interval, version))}
