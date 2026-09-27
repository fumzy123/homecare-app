from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta


def protection_end(start: datetime) -> datetime:
    if start.tzinfo is None or start.utcoffset() is None:
        raise ValueError("Founding protection requires a timezone-aware start")
    return start + relativedelta(months=12)


def notice_due_at(end: datetime) -> datetime:
    return end - timedelta(days=30)


def offer_available(offer) -> bool:
    return offer is not None and offer.released_at is None and offer.forfeited_at is None


def conversion_boundary(anchor: datetime, protected_until: datetime, notice_at: datetime) -> datetime:
    """First monthly anchor after protection and a full notice window.

    One extra day allows notice publication to commit before the 30-day cutoff.
    Calculate each boundary from the original anchor to preserve month-end days.
    """
    for value in (anchor, protected_until, notice_at):
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("Billing boundaries must be timezone-aware")
    earliest = max(protected_until, notice_at + timedelta(days=31))
    months = max(0, (earliest.year - anchor.year) * 12 + earliest.month - anchor.month)
    boundary = anchor + relativedelta(months=months)
    return boundary if boundary >= earliest else anchor + relativedelta(months=months + 1)
