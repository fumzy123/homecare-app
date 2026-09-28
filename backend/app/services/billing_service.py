import stripe
from app.domain.billing_access import billing_access
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from supabase_auth.types import User as SupabaseUser
from app.core.config import settings
from app.core.exceptions import AppError
from app.models.organization import Organization
from app.repositories.organization_repository import OrganizationRepository
from app.services.billing_onboarding_service import BillingOnboardingService, subscription_period_end, stripe_field
from app.repositories.founding_offer_repository import FoundingOfferRepository
from app.services.founding_offer_service import FoundingOfferService
from app.repositories.founding_conversion_repository import FoundingConversionRepository
from app.services.founding_conversion_service import reconcile_conversion

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
        self.founding_offer_repo = FoundingOfferRepository(db)
        self.conversion_repo = FoundingConversionRepository(db)
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
        # Retain the endpoint for old clients, but never create a subscription
        # against the retired single-price configuration. New enrollment needs
        # server-owned plan selection, consent, and trial activation.
        raise AppError(409, "USE_ONBOARDING", "Choose your plan through billing onboarding. Contact Care Harbor if your account is not enrolled yet.")

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

    async def invoice_history(self, before=None):
        org = self.org_repo.get_by_id(self.org_id)
        if not org:
            raise AppError(404, "NOT_FOUND", "Organization not found")
        customer_id = org.stripe_customer_id
        if not customer_id:
            return {"invoices": [], "next_cursor": None}
        try:
            if before:
                cursor = stripe.Invoice.retrieve(before)
                if stripe_field(cursor, "customer") != customer_id:
                    raise AppError(404, "NOT_FOUND", "Invoice not found")
            params = {"customer": customer_id, "limit": 20}
            if before:
                params["starting_after"] = before
            page = stripe.Invoice.list(**params)
            invoices = [{"id": inv.id, "number": stripe_field(inv, "number"),
                "created": inv.created, "description": stripe_field(inv, "description") or "Care Harbor subscription and usage",
                "total": inv.total, "amount_paid": inv.amount_paid, "amount_remaining": inv.amount_remaining,
                "currency": inv.currency, "status": inv.status,
                "hosted_invoice_url": stripe_field(inv, "hosted_invoice_url"),
            } for inv in page.data]
            return {"invoices": invoices, "next_cursor": invoices[-1]["id"] if page.has_more and invoices else None}
        except AppError:
            raise
        except stripe.InvalidRequestError as exc:
            raise AppError(400, "INVALID_INVOICE_REQUEST", "Could not load this invoice page") from exc
        except Exception as exc:
            raise AppError(503, "BILLING_UNAVAILABLE", "Invoice history is temporarily unavailable") from exc

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
        except stripe.SignatureVerificationError:
            raise AppError(400, "INVALID_SIGNATURE", "Invalid webhook signature")

        from app.services.billing_webhook_service import BillingWebhookService
        return BillingWebhookService(self.db).receive(event)

    def dispatch_webhook(self, event_type, data):
        if event_type == "invoice.created":
            from app.services.billing_invoice_hold_service import BillingInvoiceHoldService
            BillingInvoiceHoldService(self.db).hold(data.id)
        elif event_type in ("customer.subscription.created", "customer.subscription.updated"):
            self._handle_subscription_updated(data)
        elif event_type == "customer.subscription.deleted":
            self._handle_subscription_deleted(data)
        elif event_type == "invoice.payment_failed":
            self._handle_payment_failed(data)
        elif event_type in ("invoice.payment_succeeded", "invoice.paid") and data.status == "paid":
            self._handle_payment_succeeded(data)
        if event_type in ("invoice.payment_failed", "invoice.payment_succeeded", "invoice.paid",
                          "invoice.voided", "invoice.marked_uncollectible"):
            from app.services.billing_notice_service import BillingNoticeService
            BillingNoticeService(self.db).payment_status(data)

    def _handle_subscription_updated(self, subscription) -> None:
        try:
            org = self.org_repo.lock_by_stripe_customer_id(subscription.customer)
            if org:
                if org.subscription_id and org.subscription_id != subscription.id:
                    self.db.commit()
                    return
                # Fetch under the organization lock so concurrent stale events
                # cannot overwrite a newer status after another handler commits.
                subscription = stripe.Subscription.retrieve(subscription.id)
                org.subscription_id = subscription.id
                org.subscription_status = subscription.status
                org.subscription_current_period_end = subscription_period_end(subscription)
                if org.onboarding_deadline_at is not None:
                    reconcile_conversion(self.conversion_repo.get_for_org(org.id), subscription, datetime.now(timezone.utc))
                    org.trial_starts_at = datetime.fromtimestamp(subscription.trial_start, timezone.utc) if subscription.trial_start else None
                    org.trial_ends_at = datetime.fromtimestamp(subscription.trial_end, timezone.utc) if subscription.trial_end else None
                    if subscription.status == "canceled" or stripe_field(subscription, "cancel_at_period_end", False):
                        offer = self.founding_offer_repo.get_for_org(org.id)
                        if offer and offer.forfeited_at is None:
                            offer.forfeited_at = datetime.now(timezone.utc)
                self.db.commit()
            else:
                self.db.commit()
        except Exception:
            self.db.rollback()
            raise

    def _handle_subscription_deleted(self, subscription) -> None:
        try:
            org = self.org_repo.lock_by_stripe_customer_id(subscription.customer)
            if org:
                if org.subscription_id != subscription.id:
                    self.db.commit()
                    return
                org.subscription_status = "canceled"
                offer = self.founding_offer_repo.get_for_org(org.id)
                if offer and offer.forfeited_at is None:
                    offer.forfeited_at = datetime.now(timezone.utc)
                org.subscription_current_period_end = subscription_period_end(subscription)
                self.db.commit()
            else:
                self.db.commit()
        except Exception:
            self.db.rollback()
            raise

    def _handle_payment_failed(self, invoice) -> None:
        try:
            org = self.org_repo.get_by_stripe_customer_id(invoice.customer)
            if org:
                if org.subscription_id:
                    self._handle_subscription_updated(stripe.Subscription.retrieve(org.subscription_id))
                else:
                    self.db.commit()
        except Exception:
            self.db.rollback()
            raise

    def _handle_payment_succeeded(self, invoice) -> None:
        try:
            org = self.org_repo.get_by_stripe_customer_id(invoice.customer)
            if org and org.subscription_id:
                self._handle_subscription_updated(stripe.Subscription.retrieve(org.subscription_id))
            if org and not org.paid_at and invoice.amount_paid > 0:
                org.paid_at = datetime.now(timezone.utc)
                self.db.commit()
            if org and invoice.amount_paid > 0 and org.trial_ends_at:
                parent = stripe_field(invoice, "parent") or {}
                details = stripe_field(parent, "subscription_details") or {}
                invoice_subscription = stripe_field(invoice, "subscription") or stripe_field(details, "subscription")
                if invoice_subscription == org.subscription_id:
                    FoundingOfferService(self.db).record_paid_period(org.id, org.trial_ends_at)
        except Exception:
            self.db.rollback()
            raise

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
                return_url=f"{settings.frontend_url}/settings/billing",
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
            if org.onboarding_deadline_at is not None:
                return BillingOnboardingService(self.db, self.current_user, self.org_id).summary(org)
            now = datetime.now(timezone.utc)
            created_at = org.created_at
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            trial_ends_at = created_at + timedelta(days=trial_duration)
            is_trial_active = now < trial_ends_at
            days_left = max(0, (trial_ends_at - now).days)
            access = billing_access(org, now)
            has_access = access.can_write

            return {
                "subscription_status": org.subscription_status,
                "subscription_current_period_end": org.subscription_current_period_end,
                "is_trial_active": is_trial_active,
                "trial_days_left": days_left,
                "trial_ends_at": trial_ends_at,
                "has_access": has_access,
                "can_write": access.can_write,
                "is_read_only": not access.can_write,
            }

        except AppError:
            raise
        except Exception as e:
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))
