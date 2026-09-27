"""Freeze recorded periods atomically; no Stripe calls or charging."""
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from uuid import UUID

from app.core.exceptions import AppError
from app.domain.billing_usage import UsageWindow, active_clients
from app.models.billing_usage_snapshot import BillingUsageSnapshot
from app.repositories.billing_finalization_repository import BillingFinalizationRepository
from app.repositories.billing_usage_repository import BillingUsageRepository
from app.repositories.billing_evidence_repository import BillingEvidenceRepository


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
        self.usage_repo = BillingUsageRepository(db)
        self.evidence_repo = BillingEvidenceRepository(db)

    def finalize(self, org_id, period_id, *, now=None):
        now = now or datetime.now(timezone.utc)
        if now.tzinfo is None or now.utcoffset() is None:
            raise ValueError("Finalization time must include a timezone")
        # A dedicated session is required: all schedule/evidence queries must
        # see the same database snapshot, not multiple READ COMMITTED views.
        if self.db.in_transaction():
            raise ValueError("Finalization requires a fresh database session")
        try:
            if self.db.get_bind().dialect.name == "postgresql":
                self.db.connection(execution_options={"isolation_level": "REPEATABLE READ"})
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
            window = UsageWindow(start, end, period.agency_timezone)
            candidates = self.usage_repo.candidates(org_id, window)
            evidence = self.evidence_repo.for_window(org_id, window, [c.shift.id for c in candidates])
            clients = active_clients(candidates, window, evidence)
            versions = {(row.shift_id, row.occurrence_date): row for row in evidence
                        if row.completion_status in ("completed", "no_show")}
            witnesses = []
            for client in clients:
                version = versions.get((client.shift_id, client.occurrence_date))
                witnesses.append({
                    "client_id": str(client.client_id), "shift_id": str(client.shift_id),
                    "occurrence_date": client.occurrence_date.isoformat(),
                    "modification_id": str(client.modification_id) if client.modification_id else None,
                    "local_start": client.local_start.isoformat(),
                    "completion_status": client.completion_status.value,
                    "evidence_id": str(version.id) if version else None,
                    "evidence_revision": version.revision if version else None,
                })
            extra = max(0, len(clients) - period.included_clients)
            amount = extra * period.additional_client_amount_cents
            terms = {field: _json_value(getattr(period, field)) for field in (
                "id", "subscription_id", "agency_timezone", "plan_code", "plan_version",
                "base_interval", "included_clients", "additional_client_amount_cents", "currency",
            )}
            terms.update(starts_at=start.isoformat(), ends_at=end.isoformat(),
                         anchor_at=_utc(period.anchor_at).isoformat(), finalization_eligible_at=eligible.isoformat())
            result = {
                "schema_version": 1, "state": "finalized", "is_estimate": False,
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
