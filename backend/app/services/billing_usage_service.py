from copy import deepcopy
from dataclasses import asdict
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfoNotFoundError
from uuid import uuid4
import stripe

from app.core.exceptions import AppError
from app.domain.billing_usage import UsageWindow, active_clients
from app.repositories.billing_usage_repository import BillingUsageRepository
from app.repositories.billing_evidence_repository import BillingEvidenceRepository
from app.repositories.billing_period_repository import BillingPeriodRepository
from app.repositories.billing_finalization_repository import BillingFinalizationRepository
from app.repositories.billing_settlement_repository import BillingSettlementRepository
from app.repositories.trial_activation_repository import TrialActivationRepository
from app.repositories.billing_agreement_repository import BillingAgreementRepository
from app.repositories.founding_conversion_repository import FoundingConversionRepository
from app.domain.billing_periods import monthly_usage_window, validate_billing_timezone
from app.domain.billing import get_plan
from app.domain.billing_access import billing_access
from app.models.billing_period import BillingPeriod
from app.core.stripe_objects import stripe_field
from app.services.founding_conversion_service import reconcile_conversion
from app.core.config import settings


class BillingUsageService:
    """Agency timezone, immutable current-period terms, and usage estimates.

    HTTP callers use current(); explicit-window estimate() is internal only.
    """
    def __init__(self, db, current_user, org_id):
        if org_id is None:
            raise ValueError("Organization scope is required for billing usage")
        self.db = db
        self.current_user = current_user
        self.org_id = org_id
        self.usage_repo = BillingUsageRepository(db)
        self.evidence_repo = BillingEvidenceRepository(db)
        self.period_repo = BillingPeriodRepository(db)
        self.finalization_repo = BillingFinalizationRepository(db)
        self.trial_activation_repo = TrialActivationRepository(db)
        self.agreement_repo = BillingAgreementRepository(db)
        self.conversion_repo = FoundingConversionRepository(db)

    def settlements(self, period_id):
        if self.finalization_repo.snapshot(self.org_id, period_id) is None:
            raise AppError(404, "NOT_FOUND", "Finalized billing period not found")
        return [{field: getattr(row, field) for field in (
            "id", "period_id", "adjustment_id", "amount_cents", "currency", "state", "payment_status",
            "invoice_id", "invoice_line_id", "created_at", "updated_at", "error_code",
        )} for row in BillingSettlementRepository(self.db).period_rows(self.org_id, period_id) if not row.context.get("annual_entries")]

    def history(self, before=None):
        cursor = self.finalization_repo.snapshot(self.org_id, before) if before else None
        if before and cursor is None:
            raise AppError(404, "NOT_FOUND", "Billing history cursor not found")
        rows = self.finalization_repo.history(self.org_id, cursor)
        return {"periods": [dict(row._mapping) for row in rows[:20]],
                "next_cursor": rows[19].period_id if len(rows) > 20 else None}

    def finalized(self, period_id):
        snapshot = self.finalization_repo.snapshot(self.org_id, period_id)
        if snapshot is None:
            raise AppError(404, "NOT_FOUND", "Finalized billing period not found")
        return deepcopy(snapshot.payload)

    def _lock(self):
        org = self.trial_activation_repo.lock_organization(self.org_id)
        if not org:
            raise AppError(404, "NOT_FOUND", "Organization not found")
        return org

    def set_timezone(self, value):
        try:
            validate_billing_timezone(value)
            org = self.trial_activation_repo.lock_organization(self.org_id)
            if not org:
                raise AppError(404, "NOT_FOUND", "Organization not found")
            if org.billing_timezone and org.billing_timezone != value and org.subscription_id:
                raise AppError(409, "TIMEZONE_LOCKED", "Contact support to review a timezone change after subscription activation")
            org.billing_timezone = value
            self.db.commit()
            return {"billing_timezone": value}
        except ValueError as exc:
            self.db.rollback()
            raise AppError(422, "INVALID_TIMEZONE", str(exc)) from exc
        except Exception:
            self.db.rollback()
            raise

    def current(self, *, now=None):
        """Resolve current paid usage from Stripe, never from browser parameters.

        Creates only the current period's immutable terms, on demand. Historical
        catch-up/finalization is a separate workflow and must retain visit evidence.
        """
        if not settings.billing_onboarding_enabled:
            raise AppError(409, "ONBOARDING_DISABLED", "Billing onboarding is not enabled")
        now = now or datetime.now(timezone.utc)
        try:
            org = self._lock()
            validate_billing_timezone(org.billing_timezone)
            access = billing_access(org, now)
            if access.is_trial_active:
                end = access.trial_ends_at
                start = end - timedelta(days=14)
                timezone_name = org.billing_timezone
                self.db.commit()
                usage = self.estimate(start, end, timezone_name)
                return {"state": "ready", "trial_preview": True, "period": {
                    "id": f"trial:{self.org_id}", "starts_at": start, "ends_at": end,
                    "agency_timezone": timezone_name, "included_clients": 10,
                    "additional_client_amount_cents": 500, "currency": "cad", "base_interval": "month",
                    "finalization_eligible_at": end, "plan_code": "standard", "plan_version": 2,
                }, "usage": {**usage, "calculated_at": now,
                    "additional_clients": max(0, usage["active_client_count"] - 10),
                    "estimated_usage_amount_cents": 0,
                    "clients": [{**client, "client_name": None, "client_archived": None} for client in usage["clients"]]}}
            if not org.subscription_id or not org.trial_ends_at or now < org.trial_ends_at:
                self.db.commit()
                return {"state": "not_started", "usage": None}
            agreement = self.agreement_repo.get_for_org(org.id)
            if not agreement:
                raise ValueError("The subscription has no recorded billing agreement")
            sub = stripe.Subscription.retrieve(org.subscription_id)
            if sub.id != org.subscription_id or sub.customer != org.stripe_customer_id:
                raise ValueError("The subscription does not match this agency")
            from app.services.billing_plan_service import reconcile_standard_plan
            reconcile_standard_plan(agreement, sub)
            if sub.status not in ("active", "past_due", "unpaid"):
                self.db.commit()
                return {"state": "no_current_period", "usage": None}
            items = stripe_field(stripe_field(sub, "items", {}), "data", [])
            if len(items) != 1 or stripe_field(items[0], "quantity") != 1:
                raise ValueError("The subscription items need billing review")
            item = items[0]
            start_value, end_value = stripe_field(item, "current_period_start"), stripe_field(item, "current_period_end")
            if not start_value or not end_value:
                raise ValueError("Stripe has not confirmed the subscription period")
            base_start = datetime.fromtimestamp(start_value, timezone.utc)
            base_end = datetime.fromtimestamp(end_value, timezone.utc)
            starts_at, ends_at = monthly_usage_window(org.trial_ends_at, now)
            if agreement.base_interval == "month":
                if (base_start, base_end) != (starts_at, ends_at):
                    raise ValueError("Stripe's monthly period differs from the recorded paid anchor")
            elif agreement.base_interval == "year":
                if not base_start <= starts_at < ends_at <= base_end:
                    raise ValueError("Monthly usage falls outside the confirmed annual coverage")
            else:
                raise ValueError("Unsupported base billing interval")
            plan, expected_price = self._period_plan(org.id, agreement, sub, starts_at, ends_at, now)
            if stripe_field(stripe_field(item, "price", {}), "id") != expected_price:
                raise ValueError("Stripe's price differs from the recorded period terms")
            period = self.period_repo.get(org.id, sub.id, starts_at)
            if period:
                if (period.ends_at != ends_at or period.agency_timezone != org.billing_timezone
                        or period.plan_code != plan.code or period.plan_version != plan.version):
                    raise ValueError("Stored period terms need reconciliation; they will not be overwritten")
            else:
                period = BillingPeriod(
                    id=uuid4(), org_id=org.id, subscription_id=sub.id, starts_at=starts_at, ends_at=ends_at,
                    anchor_at=org.trial_ends_at, agency_timezone=org.billing_timezone,
                    plan_code=plan.code, plan_version=plan.version, base_interval=plan.base_interval,
                    included_clients=plan.included_clients, additional_client_amount_cents=plan.additional_client_amount_cents,
                    currency=plan.currency, finalization_eligible_at=ends_at + timedelta(hours=72),
                )
                self.period_repo.add(period)
            # Copy before commit expiration; counting uses exactly this snapshot.
            period_data = {field: getattr(period, field) for field in (
                "id", "starts_at", "ends_at", "agency_timezone", "plan_code", "plan_version", "base_interval",
                "included_clients", "additional_client_amount_cents", "currency", "finalization_eligible_at",
            )}
            self.db.commit()
        except ValueError as exc:
            self.db.rollback()
            raise AppError(409, "BILLING_PERIOD_REVIEW_REQUIRED", str(exc)) from exc
        except Exception:
            self.db.rollback()
            raise
        usage = self.estimate(period_data["starts_at"], period_data["ends_at"], period_data["agency_timezone"])
        labels = self.usage_repo.client_labels(self.org_id, [client["client_id"] for client in usage["clients"]])
        usage["clients"] = [{**client, **labels.get(client["client_id"], {
            "client_name": None, "client_archived": None,
        })} for client in usage["clients"]]
        extra = max(0, usage["active_client_count"] - period_data["included_clients"])
        return {"state": "ready", "period": period_data, "usage": {
            **usage, "calculated_at": datetime.now(timezone.utc), "additional_clients": extra,
            "estimated_usage_amount_cents": extra * period_data["additional_client_amount_cents"],
        }}

    def _period_plan(self, org_id, agreement, sub, starts_at, ends_at, now):
        code, version, price = agreement.plan_code, agreement.plan_version, agreement.stripe_price_id
        if code == "founding":
            conversion = self.conversion_repo.get_for_org(org_id)
            if conversion:
                reconcile_conversion(conversion, sub, now)
                if conversion.status == "needs_review" or starts_at < conversion.effective_at < ends_at:
                    raise ValueError("The founding transition needs review before estimating usage")
                if conversion.status == "converted" and starts_at >= conversion.effective_at:
                    code, version, price = "standard", conversion.target_plan_version, conversion.target_price_id
        return get_plan(code, agreement.base_interval, version=version), price

    def estimate(self, starts_at: datetime, ends_at: datetime, agency_timezone: str):
        try:
            window = UsageWindow(starts_at, ends_at, agency_timezone)
            candidates = self.usage_repo.candidates(self.org_id, window)
            evidence = self.evidence_repo.for_window(self.org_id, window, [c.shift.id for c in candidates])
            clients = active_clients(candidates, window, evidence)
        except (ValueError, ZoneInfoNotFoundError) as exc:
            raise AppError(409, "USAGE_REVIEW_REQUIRED", str(exc)) from exc
        return {
            "is_estimate": True, "period_start": window.starts_at, "period_end": window.ends_at,
            "agency_timezone": agency_timezone, "active_client_count": len(clients),
            "clients": [asdict(client) for client in clients],
        }
