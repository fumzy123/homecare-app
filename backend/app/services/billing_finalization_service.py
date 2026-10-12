"""Freeze recorded periods atomically; no Stripe calls or charging."""
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from uuid import UUID

from app.core.exceptions import AppError
from app.models.billing_usage_snapshot import BillingUsageSnapshot
from app.repositories.billing_finalization_repository import BillingFinalizationRepository
from app.services.billing_cutoff_service import BillingCutoffService
from app.repositories.billing_cutoff_repository import BillingCutoffRepository


def _utc(value):
    # PostgreSQL returns aware timestamptz; SQLite test storage loses tzinfo.
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _json_value(value):
    if isinstance(value, (datetime,)):
        return value.isoformat()
    if isinstance(value, UUID):
        return str(value)
    return value


class BillingFinalizationService:
    def __init__(self, db):
        self.db = db
        self.finalization_repo = BillingFinalizationRepository(db)
        self.cutoff_service = BillingCutoffService(db)
        self.cutoff_repo = BillingCutoffRepository(db)

    def finalize(self, org_id, period_id, *, now=None):
        provided_now = now
        now = now or datetime.now(timezone.utc)
        if now.tzinfo is None or now.utcoffset() is None:
            raise ValueError("Finalization time must include a timezone")
        # Dedicated session; all writers serialize on the agency before shifts.
        # READ COMMITTED sees commits made while waiting for the agency lock.
        if self.db.in_transaction():
            raise ValueError("Finalization requires a fresh database session")
        try:
            org = self.cutoff_service.seal_due(org_id, now=provided_now)
            now = provided_now or datetime.now(timezone.utc)
            period = self.finalization_repo.lock_period(org_id, period_id)
            if period is None:
                raise AppError(404, "NOT_FOUND", "Billing period not found")
            previous = self.finalization_repo.snapshot(org_id, period_id)
            if previous is not None:
                result = deepcopy(previous.payload)
                self.db.commit()
                return result
            start, end = _utc(period.starts_at), _utc(period.ends_at)
            eligible = _utc(period.finalization_eligible_at)
            if eligible != end + timedelta(hours=72):
                raise ValueError("Period correction deadline needs review")
            if now < eligible:
                raise AppError(409, "CORRECTION_WINDOW_OPEN", "The 72-hour correction window is still open")
            if (period.included_clients < 0 or period.additional_client_amount_cents < 0
                    or period.currency != "cad" or period.base_interval not in ("month", "year")):
                raise ValueError("Stored billing terms need review")
            if (org is None or org.billing_recovery_error or org.billing_recovery_checked_at is None
                    or not now - timedelta(hours=1) <= _utc(org.billing_recovery_checked_at) <= now):
                raise AppError(409, "BILLING_PERIOD_REVIEW_REQUIRED", "Recent Stripe coverage verification is required")
            if not period.source_invoice_id or not period.source_invoice_line_id:
                raise AppError(409, "BILLING_PERIOD_REVIEW_REQUIRED", "Stripe invoice coverage has not been verified")
            cutoff = self.cutoff_repo.get(org_id, period.subscription_id, start)
            if (cutoff is None or cutoff.state != "ready" or _utc(cutoff.ends_at) != end
                    or cutoff.agency_timezone != period.agency_timezone or _utc(cutoff.deadline_at) != eligible):
                raise AppError(409, "USAGE_CUTOFF_REVIEW_REQUIRED", "The correction-deadline usage needs review")
            witnesses = deepcopy(cutoff.clients)
            clients = witnesses
            extra = max(0, len(clients) - period.included_clients)
            amount = extra * period.additional_client_amount_cents
            terms = {field: _json_value(getattr(period, field)) for field in (
                "id", "subscription_id", "source_invoice_id", "source_invoice_line_id", "agency_timezone", "plan_code", "plan_version",
                "base_interval", "included_clients", "additional_client_amount_cents", "currency",
            )}
            terms.update(starts_at=start.isoformat(), ends_at=end.isoformat(),
                         anchor_at=_utc(period.anchor_at).isoformat(), finalization_eligible_at=eligible.isoformat())
            result = {
                "schema_version": 2, "cutoff_at": eligible.isoformat(), "state": "finalized", "is_estimate": False,
                "finalized_at": now.isoformat(), "period": terms,
                "active_client_count": len(clients), "additional_clients": extra,
                "usage_amount_cents": amount, "clients": witnesses,
            }
            self.finalization_repo.add(BillingUsageSnapshot(
                period_id=period.id, org_id=org_id, finalized_at=now,
                active_client_count=len(clients), additional_clients=extra,
                usage_amount_cents=amount, payload=result,
            ))
            self.db.commit()
            return result
        except Exception:
            self.db.rollback()
            raise
