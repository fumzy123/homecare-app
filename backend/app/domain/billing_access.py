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
    deadline = aware(org.onboarding_deadline_at)
    if deadline is None:
        end = aware(org.created_at) + timedelta(days=14)
        trial = now < end
        onboarding = False
    else:
        end = aware(org.trial_ends_at)
        start = aware(org.trial_starts_at)
        trial = bool(end and (not start or start <= now) and now < end
                     and org.subscription_status in (None, "trialing"))
        onboarding = (not start or start > now) and now < deadline
    allowed = org.subscription_status == "active" or trial or onboarding
    # Cancelling renewal keeps Stripe active until paid coverage ends. A terminal
    # subscription status never extends access merely because its period is future.
    if getattr(org, "deleted_at", None) or getattr(org, "is_active", True) is False:
        allowed = False
    return BillingAccess(bool(allowed), bool(onboarding), trial, end)
