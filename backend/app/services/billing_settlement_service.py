"""Prepare immutable amounts and persist each Stripe attempt before sending it."""
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from uuid import uuid4
import hashlib
import json

from app.core.config import settings
from app.models.billing_settlement import BillingSettlement
from app.repositories.billing_settlement_repository import BillingSettlementRepository
from app.repositories.billing_cutoff_repository import BillingCutoffRepository
from app.repositories.billing_finalization_repository import BillingFinalizationRepository
from app.services.billing_cutoff_service import utc


class SettlementReviewRequired(ValueError):
    pass


class SettlementBusy(RuntimeError):
    pass


def settlement_enabled():
    return settings.billing_onboarding_enabled and settings.billing_settlement_enabled


class BillingSettlementService:
    def __init__(self, db):
        self.db = db
        self.settlement_repo = BillingSettlementRepository(db)
        self.cutoff_repo = BillingCutoffRepository(db)
        self.finalization_repo = BillingFinalizationRepository(db)

    def prepare(self, org_id, period_id):
        if not settlement_enabled():
            return
        try:
            org = self.cutoff_repo.lock_organization(org_id)
            snapshot = self.finalization_repo.snapshot(org_id, period_id)
            if not org or not org.stripe_customer_id or not snapshot:
                raise SettlementReviewRequired("MISSING_BILLING_SOURCE")
            terms = snapshot.payload["period"]
            base_key = f"usage:{period_id}"
            base = self.settlement_repo.by_source(base_key)
            if base is None:
                base = self._new(org, period_id, base_key, snapshot.usage_amount_cents, terms, None)
                self.settlement_repo.add(base)
                self.db.flush()
            rows = self.settlement_repo.period_rows(org_id, period_id)
            for adjustment in self.settlement_repo.approved_adjustments(org_id, period_id):
                if adjustment.amount_cents == 0:
                    continue
                key = f"adjustment:{adjustment.id}"
                existing = self.settlement_repo.by_source(key)
                if existing:
                    if existing.state not in ("invoiced", "credited", "zero"):
                        break
                    continue
                # Original usage must be posted before subsequent deltas. A failed
                # payment does not erase the debt; credit notes can reduce open invoices.
                if base.state not in ("invoiced", "zero"):
                    break
                row = self._new(org, period_id, key, adjustment.amount_cents, terms, adjustment.id)
                if row.amount_cents < 0:
                    reserved = {}
                    for previous in rows:
                        for allocation in previous.context.get("credits", []):
                            reserved[allocation["source_id"]] = reserved.get(allocation["source_id"], 0) + allocation["amount"]
                    remaining, allocations = -row.amount_cents, []
                    for charge in rows:
                        if charge.amount_cents <= 0 or charge.state != "invoiced" or not charge.invoice_line_id:
                            continue
                        available = charge.amount_cents - reserved.get(str(charge.id), 0)
                        portion = min(remaining, max(0, available))
                        if portion:
                            allocations.append(dict(source_id=str(charge.id), invoice=charge.invoice_id,
                                                    line=charge.invoice_line_id, amount=portion))
                            remaining -= portion
                    if remaining:
                        raise SettlementReviewRequired("CREDIT_EXCEEDS_RECORDED_USAGE")
                    row.context = {**row.context, "credits": allocations}
                self.settlement_repo.add(row)
                break  # Apply in approval order, including later reversing debits.
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise

    @staticmethod
    def _new(org, period_id, key, amount, terms, adjustment_id):
        now = datetime.now(timezone.utc)
        if terms["currency"] != "cad" or terms["additional_client_amount_cents"] <= 0:
            raise SettlementReviewRequired("UNSUPPORTED_TERMS")
        return BillingSettlement(id=uuid4(), source_key=key, org_id=org.id, period_id=period_id,
            adjustment_id=adjustment_id, amount_cents=amount, currency=terms["currency"], state="ready", steps={},
            created_at=now, updated_at=now, context=dict(customer=org.stripe_customer_id,
                subscription=terms["subscription_id"], interval=terms["base_interval"],
                starts_at=terms["starts_at"], ends_at=terms["ends_at"], rate=terms["additional_client_amount_cents"]))

    def claim(self, settlement_id):
        try:
            row = self.settlement_repo.lock(settlement_id)
            now = datetime.now(timezone.utc)
            if not row or row.state in ("needs_review", "zero"):
                self.db.commit()
                return None
            if row.lease_until and utc(row.lease_until) > now:
                self.db.commit()
                return None
            token = uuid4()
            row.lease_token, row.lease_until = token, now + timedelta(minutes=5)
            row.updated_at = now
            result = {field: deepcopy(getattr(row, field)) for field in (
                "id", "org_id", "period_id", "adjustment_id", "amount_cents", "currency", "state", "context",
                "invoice_id", "invoice_line_id", "payment_status",
            )}
            self.db.commit()
            return result, token
        except Exception:
            self.db.rollback()
            raise

    def _owned(self, sid, token):
        row = self.settlement_repo.lock(sid)
        if not row or row.lease_token != token or utc(row.lease_until) <= datetime.now(timezone.utc):
            self.db.rollback()
            raise SettlementBusy("SETTLEMENT_LEASE_LOST")
        row.lease_until = datetime.now(timezone.utc) + timedelta(minutes=5)
        return row

    def step(self, sid, token, name, params, recover, send, *, creation=True):
        """Fixed parameters + fixed idempotency key, with metadata recovery after timeout."""
        row = self._owned(sid, token)
        steps = deepcopy(row.steps)
        prior = steps.get(name)
        if prior is None:
            prior = {"attempted_at": datetime.now(timezone.utc).isoformat(), "params": params}
            steps[name] = prior
            row.steps = steps
        # Freeze remote arguments, including credit-note refund amounts, on first attempt.
        fixed = deepcopy(prior["params"])
        result_id = prior.get("result_id")
        self.db.commit()
        if result_id:
            return result_id
        recovered = recover(fixed)
        if recovered:
            result_id = recovered
        else:
            if creation and datetime.now(timezone.utc) - datetime.fromisoformat(prior["attempted_at"]) > timedelta(hours=23):
                raise SettlementReviewRequired("AMBIGUOUS_OPERATION_EXPIRED")
            digest = hashlib.sha256(json.dumps(fixed, sort_keys=True).encode()).hexdigest()[:16]
            result_id = send(fixed, f"care-harbor-{sid}-{name}-{digest}")
        row = self._owned(sid, token)
        steps = deepcopy(row.steps)
        steps[name]["result_id"] = result_id
        row.steps = steps
        self.db.commit()
        return result_id

    def finish(self, sid, token, state, *, invoice_id=None, line_id=None, payment_status=None, error=None):
        try:
            row = self._owned(sid, token)
            row.state, row.error_code, row.payment_status = state, error, payment_status
            if invoice_id:
                row.invoice_id = invoice_id
            if line_id:
                row.invoice_line_id = line_id
            row.lease_token, row.lease_until = None, None
            row.updated_at = datetime.now(timezone.utc)
            if row.adjustment_id:
                for adjustment in self.settlement_repo.approved_adjustments(row.org_id, row.period_id):
                    if adjustment.id == row.adjustment_id:
                        adjustment.settlement_status = ("settled" if state == "credited" and payment_status == "credited"
                            or state == "invoiced" and payment_status == "paid" else "submitted" if state in ("credited", "invoiced") else "pending")
            if invoice_id:
                hold = self.settlement_repo.hold_by_invoice(invoice_id)
                if hold and state == "invoiced":
                    hold.state = "released"
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise
