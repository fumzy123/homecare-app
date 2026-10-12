"""Monthly usage windows, independent of the base subscription interval."""
from datetime import datetime, timezone
from dateutil.relativedelta import relativedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError, available_timezones


UNSUPPORTED_TIMEZONES = frozenset(("localtime", "posixrules", "Factory"))


def billing_timezones() -> list[str]:
    return sorted(available_timezones() - UNSUPPORTED_TIMEZONES)


def validate_billing_timezone(value: str) -> str:
    if not isinstance(value, str) or not value or value != value.strip():
        raise ValueError("Select the agency's IANA timezone")
    if value in UNSUPPORTED_TIMEZONES or value.startswith(("posix/", "right/")):
        raise ValueError("Select an explicit agency timezone, not a server-local timezone")
    try:
        ZoneInfo(value)
    except (ValueError, ZoneInfoNotFoundError) as exc:
        raise ValueError("Select a valid IANA timezone, such as America/St_Johns") from exc
    return value


def monthly_usage_window(anchor: datetime, at: datetime) -> tuple[datetime, datetime]:
    for value in (anchor, at):
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("Billing timestamps must include a timezone")
    anchor, at = anchor.astimezone(timezone.utc), at.astimezone(timezone.utc)
    if at < anchor:
        raise ValueError("Usage cannot begin before the paid anchor")
    months = (at.year - anchor.year) * 12 + at.month - anchor.month
    if anchor + relativedelta(months=months) > at:
        months -= 1
    # Always add to the original anchor: Jan 31 -> Feb 28 -> Mar 31.
    return anchor + relativedelta(months=months), anchor + relativedelta(months=months + 1)
