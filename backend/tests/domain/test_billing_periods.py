from datetime import datetime, timezone
from zoneinfo import ZoneInfo
import pytest

from app.domain.billing_periods import monthly_usage_window, validate_billing_timezone


def utc(year, month, day, hour=12):
    return datetime(year, month, day, hour, tzinfo=timezone.utc)


def test_month_end_returns_to_original_day_and_exact_time():
    anchor = utc(2026, 1, 31)
    assert monthly_usage_window(anchor, utc(2026, 2, 28, 11)) == (anchor, utc(2026, 2, 28))
    assert monthly_usage_window(anchor, utc(2026, 2, 28)) == (utc(2026, 2, 28), utc(2026, 3, 31))
    assert monthly_usage_window(anchor, utc(2026, 4, 30)) == (utc(2026, 4, 30), utc(2026, 5, 31))


def test_leap_day_anchor_does_not_drift_after_annual_renewal():
    anchor = utc(2024, 2, 29)
    assert monthly_usage_window(anchor, utc(2025, 2, 28)) == (utc(2025, 2, 28), utc(2025, 3, 29))


def test_timezone_display_does_not_shift_utc_anniversary():
    anchor = utc(2026, 2, 15)
    at = utc(2026, 3, 15).astimezone(ZoneInfo("America/St_Johns"))
    assert monthly_usage_window(anchor, at) == (utc(2026, 3, 15), utc(2026, 4, 15))


@pytest.mark.parametrize("at", [utc(2025, 12, 31), datetime(2026, 2, 1)])
def test_prepaid_anchor_and_naive_dates_rejected(at):
    with pytest.raises(ValueError):
        monthly_usage_window(utc(2026, 1, 31), at)


@pytest.mark.parametrize("zone", [None, "", "Not/AZone", " America/Toronto", "../UTC", "localtime", "Factory", "posix/UTC"])
def test_timezone_validation_does_not_guess(zone):
    with pytest.raises(ValueError):
        validate_billing_timezone(zone)


def test_explicit_utc_and_newfoundland_supported():
    assert validate_billing_timezone("UTC") == "UTC"
    assert validate_billing_timezone("America/St_Johns") == "America/St_Johns"
