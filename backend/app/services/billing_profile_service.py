"""Owner-managed billing profile and cards. Stripe owns sensitive payment data."""
import stripe
from app.core.exceptions import AppError
from app.core.stripe_objects import stripe_field
from app.repositories.organization_repository import OrganizationRepository
from app.repositories.billing_agreement_repository import BillingAgreementRepository


class BillingProfileService:
    def __init__(self, db, current_user, org_id):
        self.db, self.current_user, self.org_id = db, current_user, org_id
        self.org_repo = OrganizationRepository(db)
        self.agreement_repo = BillingAgreementRepository(db)

    def _org(self):
        org = self.org_repo.lock_by_id(self.org_id)
        if not org:
            raise AppError(404, "NOT_FOUND", "Organization not found")
        return org

    def _customer(self, org):
        if not org.stripe_customer_id:
            customer = stripe.Customer.create(
                email=self.current_user.email, metadata={"org_id": str(org.id)},
                idempotency_key=f"billing-profile-customer-{org.id}",
            )
            org.stripe_customer_id = customer.id
        return org.stripe_customer_id

    def read(self):
        try:
            org = self._org()
            result = {"name": "", "email": "", "address": {}, "cards": []}
            if org.stripe_customer_id:
                customer = stripe.Customer.retrieve(org.stripe_customer_id)
                default = stripe_field(stripe_field(customer, "invoice_settings", {}), "default_payment_method")
                if org.subscription_id:
                    sub = stripe.Subscription.retrieve(org.subscription_id)
                    if sub.customer != org.stripe_customer_id:
                        raise AppError(409, "SUBSCRIPTION_MISMATCH", "Subscription needs review")
                    default = stripe_field(sub, "default_payment_method") or default
                result.update(name=stripe_field(customer, "name") or "", email=stripe_field(customer, "email") or "",
                              address=stripe_field(customer, "address") or {})
                cards = stripe.PaymentMethod.list(customer=org.stripe_customer_id, type="card", limit=100)
                result["cards"] = [{"id": pm.id, "brand": pm.card.brand, "last4": pm.card.last4,
                    "exp_month": pm.card.exp_month, "exp_year": pm.card.exp_year, "is_default": pm.id == default}
                    for pm in cards.auto_paging_iter()]
            self.db.commit()
            return result
        except Exception:
            self.db.rollback()
            raise

    def update(self, payload):
        try:
            org = self._org()
            stripe.Customer.modify(self._customer(org), **payload)
            self.db.commit()
            return {"ok": True}
        except Exception:
            self.db.rollback()
            raise

    def setup(self):
        try:
            org = self._org()
            intent = stripe.SetupIntent.create(customer=self._customer(org), payment_method_types=["card"], usage="off_session")
            self.db.commit()
            return {"client_secret": intent.client_secret}
        except Exception:
            self.db.rollback()
            raise

    def card(self, payment_method_id, *, remove=False):
        try:
            org = self._org()
            pm = stripe.PaymentMethod.retrieve(payment_method_id)
            if not org.stripe_customer_id or pm.customer != org.stripe_customer_id or pm.type != "card":
                raise AppError(404, "NOT_FOUND", "Payment method not found")
            customer = stripe.Customer.retrieve(org.stripe_customer_id)
            default = stripe_field(stripe_field(customer, "invoice_settings", {}), "default_payment_method")
            sub = stripe.Subscription.retrieve(org.subscription_id) if org.subscription_id else None
            if sub and sub.customer != org.stripe_customer_id:
                raise AppError(409, "SUBSCRIPTION_MISMATCH", "Subscription needs review")
            agreement = self.agreement_repo.get_for_org(org.id)
            if remove:
                if payment_method_id in (default, stripe_field(sub, "default_payment_method"),
                                        agreement.payment_method_id if agreement else None):
                    raise AppError(409, "DEFAULT_CARD", "Choose another default card before removing this one")
                stripe.PaymentMethod.detach(payment_method_id)
            else:
                if sub and sub.status not in ("canceled", "incomplete_expired"):
                    stripe.Subscription.modify(sub.id, default_payment_method=payment_method_id)
                stripe.Customer.modify(org.stripe_customer_id, invoice_settings={"default_payment_method": payment_method_id})
                if agreement:
                    agreement.payment_method_id = payment_method_id
            self.db.commit()
            return {"ok": True}
        except Exception:
            self.db.rollback()
            raise

    def confirm_setup(self, setup_intent_id):
        try:
            org = self._org()
            intent = stripe.SetupIntent.retrieve(setup_intent_id)
            if not org.stripe_customer_id or intent.customer != org.stripe_customer_id or intent.status != "succeeded":
                raise AppError(409, "CARD_NOT_READY", "Card verification is not complete")
            return self.card(intent.payment_method)
        except Exception:
            self.db.rollback()
            raise
