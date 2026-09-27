from dataclasses import asdict
from datetime import datetime
from zoneinfo import ZoneInfoNotFoundError

from app.core.exceptions import AppError
from app.domain.billing_usage import UsageWindow, active_clients
from app.repositories.billing_usage_repository import BillingUsageRepository


class BillingUsageService:
    """Internal estimate calculator; callers supply authoritative period/zone.

    The upcoming Billing endpoint must obtain these from the agency and billing
    period records, not trust browser-supplied dates for financial decisions.
    """
    def __init__(self, db, current_user, org_id):
        if org_id is None:
            raise ValueError("Organization scope is required for billing usage")
        self.db = db
        self.current_user = current_user
        self.org_id = org_id
        self.usage_repo = BillingUsageRepository(db)

    def estimate(self, starts_at: datetime, ends_at: datetime, agency_timezone: str):
        try:
            window = UsageWindow(starts_at, ends_at, agency_timezone)
            clients = active_clients(self.usage_repo.candidates(self.org_id, window), window)
        except (ValueError, ZoneInfoNotFoundError) as exc:
            raise AppError(409, "USAGE_REVIEW_REQUIRED", str(exc)) from exc
        return {
            "is_estimate": True, "period_start": window.starts_at, "period_end": window.ends_at,
            "agency_timezone": agency_timezone, "active_client_count": len(clients),
            "clients": [asdict(client) for client in clients],
        }
