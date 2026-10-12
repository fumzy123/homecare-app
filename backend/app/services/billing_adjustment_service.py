"""Operator-reviewed deltas against the last approved client set."""
from copy import deepcopy
from datetime import datetime, timezone
from uuid import UUID, uuid4
from app.core.config import settings
from app.core.exceptions import AppError
from app.domain.billing_usage import UsageWindow, active_clients, usage_witnesses
from app.models.billing_adjustment import BillingAdjustment, BillingAdjustmentEvent
from app.repositories.billing_adjustment_repository import BillingAdjustmentRepository
from app.repositories.billing_finalization_repository import BillingFinalizationRepository
from app.repositories.billing_usage_repository import BillingUsageRepository
from app.repositories.billing_evidence_repository import BillingEvidenceRepository
from app.services.billing_cutoff_service import BillingCutoffService


class BillingAdjustmentService:
    def __init__(self, db, current_user=None, org_id=None):
        self.db = db
        self.current_user = current_user
        self.org_id = org_id
        self.adjustment_repo = BillingAdjustmentRepository(db)
        self.finalization_repo = BillingFinalizationRepository(db)
        self.cutoff_service = BillingCutoffService(db)
        self.usage_repo = BillingUsageRepository(db)
        self.evidence_repo = BillingEvidenceRepository(db)

    def _operator(self):
        if not self.current_user or str(self.current_user.id) not in settings.billing_operator_user_ids:
            raise AppError(403, "FORBIDDEN", "Care Harbor billing operators only")
        return UUID(str(self.current_user.id))

    @staticmethod
    def _reason(value):
        value = value.strip()
        if not 5 <= len(value) <= 1000:
            raise AppError(422, "INVALID_REASON", "Provide a reason between 5 and 1000 characters; omit care details")
        return value

    def _lock_snapshot(self, org_id, period_id):
        # Same agency-first order as all scheduling/finalization writers.
        self.cutoff_service.seal_due(org_id)
        if self.finalization_repo.lock_period(org_id, period_id) is None:
            raise AppError(404, "NOT_FOUND", "Billing period not found")
        snapshot = self.finalization_repo.snapshot(org_id, period_id)
        if snapshot is None:
            raise AppError(409, "PERIOD_NOT_FINALIZED", "Correct open-period schedules before finalization")
        return snapshot

    def _corrected_clients(self, org_id, snapshot):
        terms = snapshot.payload["period"]
        window = UsageWindow(datetime.fromisoformat(terms["starts_at"]),
                             datetime.fromisoformat(terms["ends_at"]), terms["agency_timezone"])
        candidates = self.usage_repo.candidates(org_id, window)
        evidence = self.evidence_repo.for_window(org_id, window, [c.shift.id for c in candidates])
        return usage_witnesses(active_clients(candidates, window, evidence), evidence)

    @staticmethod
    def _ids(clients):
        return {row["client_id"] for row in clients}

    def propose(self, org_id, period_id, request_id, reason):
        actor, reason = self._operator(), self._reason(reason)
        try:
            snapshot = self._lock_snapshot(org_id, period_id)
            previous_request = self.adjustment_repo.by_request(org_id, period_id, request_id)
            if previous_request:
                if previous_request.reason != reason or previous_request.proposed_by != actor:
                    raise AppError(409, "IDEMPOTENCY_CONFLICT", "This request ID was already used for a different proposal")
                result = self._response(previous_request)
                self.db.commit()
                return result
            latest = self.adjustment_repo.latest_approved(org_id, period_id)
            baseline = latest.payload["corrected_clients"] if latest else snapshot.payload["clients"]
            corrected = self._corrected_clients(org_id, snapshot)
            before, after = self._ids(baseline), self._ids(corrected)
            if before == after:
                raise AppError(409, "NO_USAGE_CHANGE", "The counted client list has not changed since the last approved total")
            terms = snapshot.payload["period"]
            included, rate = terms["included_clients"], terms["additional_client_amount_cents"]
            if included < 0 or rate < 0 or terms["currency"] != "cad":
                raise AppError(409, "BILLING_PERIOD_REVIEW_REQUIRED", "Stored rates need review")
            baseline_amount = max(0, len(before) - included) * rate
            target_amount = max(0, len(after) - included) * rate
            expected_baseline = latest.payload["corrected_usage_amount_cents"] if latest else snapshot.usage_amount_cents
            if expected_baseline != baseline_amount:
                raise AppError(409, "BILLING_PERIOD_REVIEW_REQUIRED", "Previous approved amount does not match its client list")
            now = datetime.now(timezone.utc)
            row = BillingAdjustment(id=uuid4(), org_id=org_id, period_id=period_id, request_id=request_id,
                baseline_sequence=latest.approval_sequence if latest else 0, status="pending",
                amount_cents=target_amount - baseline_amount, currency=terms["currency"], reason=reason,
                proposed_by=actor, proposed_at=now, settlement_status="not_approved", payload={
                    "baseline_clients": deepcopy(baseline), "corrected_clients": corrected,
                    "added_client_ids": sorted(after - before), "removed_client_ids": sorted(before - after),
                    "included_clients": included, "additional_client_amount_cents": rate,
                    "baseline_usage_amount_cents": baseline_amount, "corrected_usage_amount_cents": target_amount,
                })
            self.adjustment_repo.add(row)
            self.db.flush()  # Insert parent before its audit event; transaction remains atomic.
            self.adjustment_repo.add_event(BillingAdjustmentEvent(adjustment_id=row.id, action="proposed",
                actor_id=actor, reason=reason, occurred_at=now))
            self.db.flush()
            result = self._response(row)
            self.db.commit()
            return result
        except Exception:
            self.db.rollback()
            raise

    def decide(self, org_id, period_id, adjustment_id, decision, reason):
        actor, reason = self._operator(), self._reason(reason)
        if decision not in ("approved", "rejected"):
            raise AppError(422, "INVALID_DECISION", "Approve or reject this proposal")
        try:
            snapshot = self._lock_snapshot(org_id, period_id)
            row = self.adjustment_repo.get(org_id, period_id, adjustment_id)
            if row is None:
                raise AppError(404, "NOT_FOUND", "Adjustment not found")
            if row.status != "pending":
                if row.status != decision or row.decided_by != actor or row.decision_reason != reason:
                    raise AppError(409, "ALREADY_DECIDED", "This adjustment already has a recorded decision")
                result = self._response(row)
                self.db.commit()
                return result
            if decision == "approved":
                latest = self.adjustment_repo.latest_approved(org_id, period_id)
                sequence = latest.approval_sequence if latest else 0
                if row.baseline_sequence != sequence:
                    raise AppError(409, "STALE_ADJUSTMENT", "Another adjustment was approved; create a new proposal")
                if self._ids(self._corrected_clients(org_id, snapshot)) != self._ids(row.payload["corrected_clients"]):
                    raise AppError(409, "USAGE_CHANGED", "The client list changed after this proposal; review a new proposal")
                row.approval_sequence = sequence + 1
                row.settlement_status = "pending" if row.amount_cents else "not_required"
            row.status, row.decided_by = decision, actor
            row.decided_at, row.decision_reason = datetime.now(timezone.utc), reason
            self.adjustment_repo.add_event(BillingAdjustmentEvent(adjustment_id=row.id, action=decision,
                actor_id=actor, reason=reason, occurred_at=row.decided_at))
            self.db.flush()
            result = self._response(row)
            self.db.commit()
            return result
        except Exception:
            self.db.rollback()
            raise

    def list(self, period_id):
        if self.org_id is None:
            raise AppError(403, "FORBIDDEN", "Agency scope is required")
        return self._list_for_org(self.org_id, period_id)

    def operator_list(self, org_id, period_id):
        self._operator()
        return self._list_for_org(org_id, period_id)

    def _list_for_org(self, org_id, period_id):
        if self.finalization_repo.snapshot(org_id, period_id) is None:
            raise AppError(404, "NOT_FOUND", "Finalized billing period not found")
        rows = self.adjustment_repo.list(org_id, period_id)
        events = self.adjustment_repo.events(org_id, period_id)
        return {"adjustments": [self._response(row) for row in rows], "events": [{
            "id": event.id, "adjustment_id": event.adjustment_id, "action": event.action,
            "actor_id": event.actor_id, "reason": event.reason, "occurred_at": event.occurred_at,
        } for event in events]}

    @staticmethod
    def _response(row):
        return {field: deepcopy(getattr(row, field)) for field in (
            "id", "period_id", "request_id", "baseline_sequence", "approval_sequence", "status",
            "amount_cents", "currency", "reason", "proposed_by", "proposed_at", "decided_by",
            "decided_at", "decision_reason", "settlement_status", "payload",
        )}
