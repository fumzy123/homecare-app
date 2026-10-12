"""Pure onboarding/trial timing rules; Stripe activation is service-owned."""
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

ONBOARDING_DURATION = timedelta(days=30)
TRIAL_DURATION = timedelta(days=14)


def _utc(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("Trial timestamps must include a timezone")
    return value.astimezone(timezone.utc)


def onboarding_deadline(signup_at: datetime) -> datetime:
    return _utc(signup_at) + ONBOARDING_DURATION


@dataclass(frozen=True)
class TrialWindow:
    starts_at: datetime
    ends_at: datetime


def trial_window(
    deadline: datetime,
    *,
    now: datetime,
    onboarding_completed_at: datetime | None = None,
    existing_start: datetime | None = None,
    existing_end: datetime | None = None,
) -> TrialWindow | None:
    """Return a due window without extending it when a backstop runs late.

    Existing confirmed timestamps take precedence. A past-ended result requires
    reconciliation, not a retroactive charge or a freshly restarted trial.
    """
    if (existing_start is None) != (existing_end is None):
        raise ValueError("An existing trial requires both start and end")
    if existing_start is not None:
        start, end = _utc(existing_start), _utc(existing_end)
        if end <= start:
            raise ValueError("Trial end must follow its start")
        return TrialWindow(start, end)
    current = _utc(now)
    start = _utc(deadline)
    if onboarding_completed_at is not None:
        onboarding_completion = _utc(onboarding_completed_at)
        if onboarding_completion > current:
            raise ValueError("Onboarding completion cannot be in the future")
        start = min(start, onboarding_completion)
    if start > current:
        return None
    return TrialWindow(start, start + TRIAL_DURATION)
