from datetime import datetime, timedelta, timezone

import pytest

from app.domain.trials import onboarding_deadline, trial_window

SIGNUP = datetime(2026, 9, 1, 12, tzinfo=timezone.utc)
DEADLINE = SIGNUP + timedelta(days=30)


def test_onboarding_has_no_trial_before_deadline():
    assert onboarding_deadline(SIGNUP) == DEADLINE
    assert trial_window(DEADLINE, now=SIGNUP) is None


def test_manual_go_live_starts_fourteen_days():
    live = SIGNUP + timedelta(days=4)
    window = trial_window(DEADLINE, now=live, go_live_at=live)
    assert window.starts_at == live
    assert window.ends_at == live + timedelta(days=14)


@pytest.mark.parametrize("late_days", [0, 3, 20])
def test_backstop_delay_never_restarts_clock(late_days):
    now = DEADLINE + timedelta(days=late_days)
    window = trial_window(DEADLINE, now=now)
    assert window.starts_at == DEADLINE
    assert window.ends_at == DEADLINE + timedelta(days=14)


def test_late_go_live_cannot_extend_backstop():
    live = DEADLINE + timedelta(days=2)
    assert trial_window(DEADLINE, now=live, go_live_at=live).starts_at == DEADLINE


def test_confirmed_stripe_window_is_preserved_on_retry():
    end = SIGNUP + timedelta(days=14, hours=1)
    window = trial_window(DEADLINE, now=DEADLINE, existing_start=SIGNUP, existing_end=end)
    assert window.starts_at == SIGNUP
    assert window.ends_at == end


def test_partial_existing_window_rejected():
    with pytest.raises(ValueError):
        trial_window(DEADLINE, now=DEADLINE, existing_start=SIGNUP)


def test_reversed_existing_window_rejected():
    with pytest.raises(ValueError):
        trial_window(DEADLINE, now=DEADLINE, existing_start=DEADLINE, existing_end=SIGNUP)


def test_future_go_live_rejected():
    with pytest.raises(ValueError):
        trial_window(DEADLINE, now=SIGNUP, go_live_at=SIGNUP + timedelta(days=1))


def test_naive_timestamp_rejected():
    with pytest.raises(ValueError):
        onboarding_deadline(SIGNUP.replace(tzinfo=None))


def test_offset_normalized_to_utc():
    local = SIGNUP.astimezone(timezone(timedelta(hours=-3, minutes=-30)))
    assert onboarding_deadline(local) == DEADLINE
