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
