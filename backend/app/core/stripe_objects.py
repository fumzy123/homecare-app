"""Read Stripe response objects without depending on SDK-specific dict methods."""
from datetime import datetime, timezone


def subscription_period_end(subscription):
    """Current Stripe versions expose periods on subscription items."""
    items = stripe_field(stripe_field(subscription, "items", {}), "data", [])
    end = (stripe_field(items[0], "current_period_end") if items else None) or stripe_field(subscription, "current_period_end")
    return datetime.fromtimestamp(end, timezone.utc) if end else None


def stripe_field(obj, key, default=None):
    """Stripe SDK 15 objects support indexing, but no longer dict.get()."""
    try:
        return obj[key]
    except KeyError:
        return default
