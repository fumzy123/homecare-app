"""Hold eligible monthly renewal drafts; initial trial conversion is untouched."""
from datetime import datetime, timedelta, timezone
import stripe
from app.core.config import settings
from app.core.stripe_objects import stripe_field as field
from app.domain.billing import get_plan
from app.domain.billing_periods import monthly_usage_window
from app.models.billing_settlement import BillingInvoiceHold
from app.repositories.organization_repository import OrganizationRepository
from app.repositories.billing_agreement_repository import BillingAgreementRepository
from app.repositories.founding_conversion_repository import FoundingConversionRepository
from app.repositories.billing_settlement_repository import BillingSettlementRepository
from app.services.billing_cutoff_service import utc
from app.services.billing_settlement_service import settlement_enabled, SettlementReviewRequired


class BillingInvoiceHoldService:
    def __init__(self, db):
        self.db = db
        self.org_repo = OrganizationRepository(db)
        self.agreement_repo = BillingAgreementRepository(db)
        self.conversion_repo = FoundingConversionRepository(db)
        self.settlement_repo = BillingSettlementRepository(db)

    def hold(self, invoice_id):
        if not settlement_enabled():
            return
        invoice = stripe.Invoice.retrieve(invoice_id)
        if field(invoice, "livemode", False) and not settings.billing_settlement_live_enabled:
            raise SettlementReviewRequired("LIVE_SETTLEMENT_DISABLED")
        if invoice.status != "draft" or field(invoice, "billing_reason") != "subscription_cycle":
            return
        try:
            org = self.org_repo.lock_by_stripe_customer_id(invoice.customer)
            agreement = self.agreement_repo.get_for_org(org.id) if org else None
            if (not org or org.onboarding_deadline_at is None or not org.trial_ends_at
                    or not agreement or agreement.base_interval != "month"):
                self.db.commit()
                return
            parent = field(field(invoice, "parent", {}), "subscription_details", {})
            if (field(parent, "subscription") or field(invoice, "subscription")) != org.subscription_id:
                self.db.commit()
                return
            # Stripe is outside this lock after the context has been copied.
            context = dict(org_id=org.id, subscription=org.subscription_id, customer=org.stripe_customer_id,
                           anchor=utc(org.trial_ends_at), price=agreement.stripe_price_id,
                           code=agreement.plan_code, version=agreement.plan_version)
            conversion = self.conversion_repo.get_for_org(org.id)
            if conversion:
                context["conversion"] = (utc(conversion.effective_at), conversion.target_price_id, conversion.target_plan_version)
            self.db.commit()
            lines = list(stripe.Invoice.list_lines(invoice.id, limit=100).auto_paging_iter())
            base = [line for line in lines if field(field(line, "parent", {}), "type") == "subscription_item_details"
                    or field(line, "type") == "subscription"]
            if len(base) != 1:
                raise SettlementReviewRequired("UNEXPECTED_RENEWAL_LINES")
            line = base[0]
            start = datetime.fromtimestamp(field(field(line, "period", {}), "start"), timezone.utc)
            if start <= context["anchor"]:
                return  # Signup/first paid conversion must not wait for old usage.
            end = datetime.fromtimestamp(field(field(line, "period", {}), "end"), timezone.utc)
            if monthly_usage_window(context["anchor"], start) != (start, end):
                raise SettlementReviewRequired("RENEWAL_ANCHOR_MISMATCH")
            price, code, version = context["price"], context["code"], context["version"]
            conversion = context.get("conversion")
            if conversion and start >= conversion[0]:
                price, code, version = conversion[1], "standard", conversion[2]
            actual_price = field(field(field(line, "pricing", {}), "price_details", {}), "price") or field(field(line, "price", {}), "id")
            plan = get_plan(code, "month", version=version)
            if (actual_price != price or line.amount != plan.base_amount_cents or line.quantity != 1
                    or line.currency != "cad" or field(field(field(line, "parent", {}), "subscription_item_details", {}), "proration", False)):
                raise SettlementReviewRequired("RENEWAL_TERMS_MISMATCH")
            previous_start, previous_end = monthly_usage_window(context["anchor"], start - timedelta(microseconds=1))
            org = self.org_repo.lock_by_stripe_customer_id(context["customer"])
            if not org or org.id != context["org_id"] or org.subscription_id != context["subscription"]:
                raise SettlementReviewRequired("RENEWAL_OWNERSHIP_CHANGED")
            hold = self.settlement_repo.hold(org.id, context["subscription"], previous_start)
            if hold and hold.invoice_id != invoice.id:
                raise SettlementReviewRequired("DUPLICATE_RENEWAL_INVOICE")
            if (hold and hold.state in ("held", "released")) or self.settlement_repo.completed_usage(
                    org.id, context["subscription"], previous_start):
                self.db.commit()
                return
            if hold is None:
                hold = BillingInvoiceHold(invoice_id=invoice.id, org_id=org.id, subscription_id=context["subscription"],
                    usage_starts_at=previous_start, usage_ends_at=previous_end, state="pending",
                    base_line_id=line.id, base_amount_cents=line.amount)
                self.settlement_repo.add(hold)
            self.db.commit()
            # Absolute update is safe to repeat even outside Stripe's key lifetime.
            stripe.Invoice.modify(invoice.id, auto_advance=False,
                metadata={"care_harbor_usage_start": previous_start.isoformat()},
                idempotency_key=f"care-harbor-hold-{invoice.id}")
            hold = self.settlement_repo.hold_by_invoice(invoice.id)
            hold.state = "held"
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise
