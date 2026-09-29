"""Shared subscription entitlement rules; no database or Stripe calls."""
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone


def aware(value):
    return value.replace(tzinfo=timezone.utc) if value and value.tzinfo is None else value


@dataclass(frozen=True)
class BillingAccess:
    can_write: bool
    is_onboarding: bool
    is_trial_active: bool
    trial_ends_at: datetime | None


def billing_access(org, now=None):
    now = aware(now) if now else datetime.now(timezone.utc)
    # Once subscribed, preserve the confirmed Stripe trial end. Before purchase,
    # trial access always begins at agency creation, independent of onboarding.
    if org.subscription_status is not None:
        end = aware(org.trial_ends_at)
        start = aware(org.trial_starts_at)
    else:
        start = aware(org.created_at)
        end = start + timedelta(days=14)
    trial = bool(end and (not start or start <= now) and now < end
                 and org.subscription_status in (None, "trialing"))
    allowed = org.subscription_status == "active" or trial
    # Cancelling renewal keeps Stripe active until paid coverage ends. A terminal
    # subscription status never extends access merely because its period is future.
    if getattr(org, "deleted_at", None) or getattr(org, "is_active", True) is False:
        allowed = False
    return BillingAccess(bool(allowed), False, trial, end)
