import stripe
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from supabase_auth.types import User as SupabaseUser
from app.core.config import settings
from app.core.exceptions import AppError
from app.models.organization import Organization
from app.repositories.organization_repository import OrganizationRepository

stripe.api_key = settings.stripe_secret_key


class BillingService:

    def __init__(
        self,
        db: Session,
        current_user: SupabaseUser | None = None,
        org_id=None,
    ):
        self.db = db
        self.current_user = current_user
        self.org_repo = OrganizationRepository(db)
        # org_id is None for the webhook route (no auth — Stripe signature used instead)
        self.org_id = org_id

    # ─────────────────────────────────────────
    # Internal helper — get or create Stripe customer
    # ─────────────────────────────────────────
    def _get_or_create_customer(self, org: Organization) -> str:
        if org.stripe_customer_id:
            return org.stripe_customer_id
        customer = stripe.Customer.create(
            email=self.current_user.email,
            metadata={"org_id": str(org.id)},
        )
        org.stripe_customer_id = customer.id
        self.db.commit()
        return customer.id

    # ─────────────────────────────────────────
    # 1. Create subscription + return PaymentIntent client_secret
    # ─────────────────────────────────────────
    async def create_subscription_intent(self) -> dict:
        try:
            org = self.org_repo.get_by_id(self.org_id)
            if not org:
                raise AppError(404, "NOT_FOUND", "Organization not found")
            if org.subscription_status == "active":
                raise AppError(400, "ALREADY_SUBSCRIBED", "This organization already has an active subscription")

            customer_id = self._get_or_create_customer(org)

            subscription = stripe.Subscription.create(
                customer=customer_id,
                items=[{"price": settings.stripe_price_id}],
                payment_behavior="default_incomplete",
                payment_settings={"save_default_payment_method": "on_subscription"},
                expand=["latest_invoice.confirmation_secret"],
            )

            org.subscription_id = subscription.id
            self.db.commit()

            return {"client_secret": subscription.latest_invoice.confirmation_secret.client_secret}

        except AppError:
            raise
        except Exception as e:
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 2. Create SetupIntent for updating the card
    # ─────────────────────────────────────────
    async def create_setup_intent(self) -> dict:
        try:
            org = self.org_repo.get_by_id(self.org_id)
            if not org:
                raise AppError(404, "NOT_FOUND", "Organization not found")
            if not org.stripe_customer_id:
                raise AppError(400, "NO_CUSTOMER", "No billing account found — subscribe first")

            setup_intent = stripe.SetupIntent.create(
                customer=org.stripe_customer_id,
                payment_method_types=["card"],
                usage="off_session",
            )
            return {"client_secret": setup_intent.client_secret}

        except AppError:
            raise
        except Exception as e:
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 3. Set a confirmed payment method as the subscription default
    # ─────────────────────────────────────────
    async def set_default_payment_method(self, payment_method_id: str) -> dict:
        try:
            org = self.org_repo.get_by_id(self.org_id)
            if not org:
                raise AppError(404, "NOT_FOUND", "Organization not found")
            if not org.stripe_customer_id:
                raise AppError(400, "NO_CUSTOMER", "No billing account found")

            stripe.Customer.modify(
                org.stripe_customer_id,
                invoice_settings={"default_payment_method": payment_method_id},
            )
            if org.subscription_id:
                stripe.Subscription.modify(
                    org.subscription_id,
                    default_payment_method=payment_method_id,
                )
            return {"ok": True}

        except AppError:
            raise
        except Exception as e:
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 4. Fetch card + invoice data from Stripe
    # ─────────────────────────────────────────
    async def get_billing_details(self) -> dict:
        try:
            org = self.org_repo.get_by_id(self.org_id)
            if not org:
                raise AppError(404, "NOT_FOUND", "Organization not found")
            if not org.stripe_customer_id:
                return {"card": None, "invoices": []}

            customer = stripe.Customer.retrieve(
                org.stripe_customer_id,
                expand=["invoice_settings.default_payment_method"],
            )

            card = None
            pm = customer.invoice_settings.default_payment_method
            if pm and hasattr(pm, "card"):
                addr = pm.billing_details.address if pm.billing_details else None
                card = {
                    "brand": pm.card.brand,
                    "last4": pm.card.last4,
                    "exp_month": pm.card.exp_month,
                    "exp_year": pm.card.exp_year,
                    "postal_code": addr.postal_code if addr else None,
                }

            invoices_resp = stripe.Invoice.list(customer=org.stripe_customer_id, limit=20)
            invoices = []
            for inv in invoices_resp.data:
                description = "Subscription"
                if inv.lines and inv.lines.data:
                    description = inv.lines.data[0].description or "Subscription"
                invoices.append({
                    "id": inv.id,
                    "created": inv.created,
                    "description": description,
                    "amount_paid": inv.amount_paid,
                    "currency": inv.currency,
                    "status": inv.status,
                    "hosted_invoice_url": inv.hosted_invoice_url,
                })

            return {"card": card, "invoices": invoices}

        except AppError:
            raise
        except Exception as e:
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 5. Stripe webhook handler
    # ─────────────────────────────────────────
    async def handle_webhook(self, payload: bytes, sig_header: str) -> dict:
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, settings.stripe_webhook_secret
            )
        except ValueError:
            raise AppError(400, "INVALID_PAYLOAD", "Invalid webhook payload")
        except stripe.error.SignatureVerificationError:
            raise AppError(400, "INVALID_SIGNATURE", "Invalid webhook signature")

        event_type = event["type"]
        data = event["data"]["object"]

        if event_type in ("customer.subscription.created", "customer.subscription.updated"):
            self._handle_subscription_updated(data)
        elif event_type == "customer.subscription.deleted":
            self._handle_subscription_deleted(data)
        elif event_type == "invoice.payment_failed":
            self._handle_payment_failed(data)
        elif event_type == "invoice.payment_succeeded":
            self._handle_payment_succeeded(data)

        return {"received": True}

    def _handle_subscription_updated(self, subscription) -> None:
        try:
            org = self.org_repo.get_by_stripe_customer_id(subscription.customer)
            if org:
                org.subscription_id = subscription.id
                org.subscription_status = subscription.status
                org.subscription_current_period_end = datetime.fromtimestamp(
                    subscription.current_period_end, tz=timezone.utc
                )
                self.db.commit()
        except Exception:
            self.db.rollback()

    def _handle_subscription_deleted(self, subscription) -> None:
        try:
            org = self.org_repo.get_by_stripe_customer_id(subscription.customer)
            if org:
                org.subscription_status = "canceled"
                org.subscription_current_period_end = datetime.fromtimestamp(
                    subscription.current_period_end, tz=timezone.utc
                )
                self.db.commit()
        except Exception:
            self.db.rollback()

    def _handle_payment_failed(self, invoice) -> None:
        try:
            org = self.org_repo.get_by_stripe_customer_id(invoice.customer)
            if org:
                org.subscription_status = "past_due"
                self.db.commit()
        except Exception:
            self.db.rollback()

    def _handle_payment_succeeded(self, invoice) -> None:
        try:
            org = self.org_repo.get_by_stripe_customer_id(invoice.customer)
            if org and not org.paid_at:
                org.paid_at = datetime.now(timezone.utc)
                self.db.commit()
        except Exception:
            self.db.rollback()

    # ─────────────────────────────────────────
    # 6. Customer portal
    # ─────────────────────────────────────────
    async def create_portal_session(self) -> dict:
        try:
            org = self.org_repo.get_by_id(self.org_id)
            if not org:
                raise AppError(404, "NOT_FOUND", "Organization not found")
            if not org.stripe_customer_id:
                raise AppError(400, "NO_CUSTOMER", "No billing account found — subscribe first")

            session = stripe.billing_portal.Session.create(
                customer=org.stripe_customer_id,
                return_url=f"{settings.frontend_url}/settings",
            )
            return {"url": session.url}

        except AppError:
            raise
        except Exception as e:
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 7. Billing status for the plan card
    # ─────────────────────────────────────────
    async def get_billing_status(self) -> dict:
        try:
            org = self.org_repo.get_by_id(self.org_id)
            if not org:
                raise AppError(404, "NOT_FOUND", "Organization not found")

            trial_duration = 14
            now = datetime.now(timezone.utc)
            created_at = org.created_at
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            trial_ends_at = created_at + timedelta(days=trial_duration)
            is_trial_active = now < trial_ends_at
            days_left = max(0, (trial_ends_at - now).days)
            has_access = org.subscription_status == "active" or is_trial_active

            return {
                "subscription_status": org.subscription_status,
                "subscription_current_period_end": org.subscription_current_period_end,
                "is_trial_active": is_trial_active,
                "trial_days_left": days_left,
                "trial_ends_at": trial_ends_at,
                "has_access": has_access,
            }

        except AppError:
            raise
        except Exception as e:
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))
