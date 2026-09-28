"""Recover periods from Stripe read-only history; never create charges."""
from datetime import datetime, timedelta, timezone
from uuid import uuid4
import stripe
from app.core.stripe_objects import stripe_field
from app.domain.billing_recovery import invoice_periods
from app.models.billing_period import BillingPeriod
from app.repositories.billing_cutoff_repository import BillingCutoffRepository
from app.repositories.billing_agreement_repository import BillingAgreementRepository
from app.repositories.founding_conversion_repository import FoundingConversionRepository
from app.repositories.billing_period_repository import BillingPeriodRepository
from app.repositories.billing_settlement_repository import BillingSettlementRepository
from app.services.billing_cutoff_service import utc


class BillingPeriodRecoveryService:
    def __init__(self, db):
        self.db = db
        self.cutoff_repo = BillingCutoffRepository(db)
        self.agreement_repo = BillingAgreementRepository(db)
        self.conversion_repo = FoundingConversionRepository(db)
        self.period_repo = BillingPeriodRepository(db)

    def _context(self, org):
        if not org or org.onboarding_deadline_at is None or not org.subscription_id or not org.trial_ends_at or not org.billing_timezone:
            raise ValueError("Agency is not ready for usage recovery")
        agreement = self.agreement_repo.get_for_org(org.id)
        if agreement is None:
            raise ValueError("Missing billing agreement")
        conversion = self.conversion_repo.get_for_org(org.id)
        context = dict(subscription_id=org.subscription_id, customer_id=org.stripe_customer_id,
            anchor=utc(org.trial_ends_at), timezone=org.billing_timezone, plan_code=agreement.plan_code,
            plan_version=agreement.plan_version, interval=agreement.base_interval, price_id=agreement.stripe_price_id)
        if conversion and conversion.status != "canceled":
            if conversion.subscription_id != org.subscription_id or conversion.status == "needs_review":
                raise ValueError("Founding conversion needs review")
            context["conversion"] = dict(effective_at=utc(conversion.effective_at),
                version=conversion.target_plan_version, price_id=conversion.target_price_id)
        return context

    def recover(self, org_id, *, now=None):
        now = now or datetime.now(timezone.utc)
        try:
            context = self._context(self.cutoff_repo.lock_organization(org_id))
            known_credits = BillingSettlementRepository(self.db).credit_ids(org_id)
            self.db.commit()  # No database locks are held during Stripe reads.
            sub = stripe.Subscription.retrieve(context["subscription_id"])
            history = []
            verified_credits = set()
            for invoice in stripe.Invoice.list(customer=context["customer_id"], subscription=context["subscription_id"], limit=100).auto_paging_iter():
                credited = stripe_field(invoice, "post_payment_credit_notes_amount", 0) + stripe_field(invoice, "pre_payment_credit_notes_amount", 0)
                if credited:
                    notes = [note for note in stripe.CreditNote.list(invoice=invoice.id, limit=100).auto_paging_iter()
                             if note.status == "issued"]
                    if notes and all(note.id in known_credits for note in notes) and sum(note.amount for note in notes) == credited:
                        verified_credits.add(invoice.id)
                lines = stripe_field(invoice, "lines", {})
                if stripe_field(lines, "has_more", False):
                    rows = list(stripe.Invoice.list_lines(invoice.id, limit=100).auto_paging_iter())
                else:
                    rows = stripe_field(lines, "data", [])
                history.append((invoice, rows))
            proposals, partial = invoice_periods({**context, "verified_usage_credit_invoices": verified_credits}, sub, history, now)
            org = self.cutoff_repo.lock_organization(org_id)
            if self._context(org) != context:
                raise ValueError("Billing terms changed while reading Stripe")
            for start, (end, plan, invoice_id, line_id) in proposals.items():
                if not invoice_id or not line_id:
                    raise ValueError("Missing invoice evidence")
                existing = self.period_repo.get(org_id, context["subscription_id"], start)
                if existing:
                    if (utc(existing.ends_at) != end or utc(existing.anchor_at) != context["anchor"]
                            or existing.agency_timezone != context["timezone"] or existing.plan_code != plan.code
                            or existing.plan_version != plan.version or existing.base_interval != plan.base_interval
                            or existing.included_clients != plan.included_clients or existing.currency != plan.currency
                            or existing.additional_client_amount_cents != plan.additional_client_amount_cents
                            or utc(existing.finalization_eligible_at) != end + timedelta(hours=72)
                            or existing.source_invoice_id not in (None, invoice_id)
                            or existing.source_invoice_line_id not in (None, line_id)):
                        raise ValueError("Stored period differs from invoice coverage")
                    existing.source_invoice_id, existing.source_invoice_line_id = invoice_id, line_id
                else:
                    self.period_repo.add(BillingPeriod(id=uuid4(), org_id=org_id,
                        subscription_id=context["subscription_id"], starts_at=start, ends_at=end,
                        anchor_at=context["anchor"], agency_timezone=context["timezone"],
                        plan_code=plan.code, plan_version=plan.version, base_interval=plan.base_interval,
                        included_clients=plan.included_clients, additional_client_amount_cents=plan.additional_client_amount_cents,
                        currency=plan.currency, finalization_eligible_at=end + timedelta(hours=72),
                        source_invoice_id=invoice_id, source_invoice_line_id=line_id))
            missing = any(utc(row.ends_at) <= now and utc(row.starts_at) not in proposals for row in
                          self.period_repo.for_subscription(org_id, context["subscription_id"]))
            org.billing_recovery_checked_at = now
            org.billing_recovery_error = ("PARTIAL_CANCELLATION_REVIEW_REQUIRED" if partial
                                          else "MISSING_INVOICE_COVERAGE" if missing else None)
            self.db.commit()
            return len(proposals)
        except Exception:
            self.db.rollback()
            org = self.cutoff_repo.lock_organization(org_id)
            if org:
                org.billing_recovery_checked_at = now
                org.billing_recovery_error = "BILLING_PERIOD_RECOVERY_FAILED"
                self.db.commit()
            raise
