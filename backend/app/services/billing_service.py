import stripe
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from supabase_auth.types import User as SupabaseUser
from app.core.config import settings
from app.core.exceptions import AppError
from app.models.organization import Organization
from app.services.org_service import OrgService

stripe.api_key = settings.stripe_secret_key


class BillingService:

    # ─────────────────────────────────────────
    # 1. Create Stripe Checkout Session
    # ─────────────────────────────────────────
    @staticmethod
    async def create_checkout_session(current_user: SupabaseUser, db: Session) -> dict:
        try:
            org_id = OrgService.get_admin_org_id(current_user, db)
            org = db.query(Organization).filter(Organization.id == org_id).first()
            if not org:
                raise AppError(404, "NOT_FOUND", "Organization not found")

            if org.subscription_status == "active":
                raise AppError(400, "ALREADY_SUBSCRIBED", "This organization already has an active subscription")

            session = stripe.checkout.Session.create(
                mode="subscription",
                line_items=[{"price": settings.stripe_price_id, "quantity": 1}],
                success_url=f"{settings.frontend_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
                cancel_url=f"{settings.frontend_url}/#pricing",
                customer_email=current_user.email,
                metadata={"org_id": str(org_id)},
            )

            return {"url": session.url}

        except AppError:
            raise
        except Exception as e:
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 2. Handle Stripe Webhook
    # ─────────────────────────────────────────
    @staticmethod
    async def handle_webhook(payload: bytes, sig_header: str, db: Session) -> dict:
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

        if event_type == "checkout.session.completed":
            BillingService._handle_checkout_completed(data, db)
        elif event_type in ("customer.subscription.created", "customer.subscription.updated"):
            BillingService._handle_subscription_updated(data, db)
        elif event_type == "customer.subscription.deleted":
            BillingService._handle_subscription_deleted(data, db)
        elif event_type == "invoice.payment_failed":
            BillingService._handle_payment_failed(data, db)

        return {"received": True}

    # ─────────────────────────────────────────
    # Webhook event handlers
    # ─────────────────────────────────────────
    @staticmethod
    def _handle_checkout_completed(session, db: Session) -> None:
        org_id_str = session.metadata.get("org_id") if session.metadata else None
        if not org_id_str:
            return
        try:
            org = db.query(Organization).filter(
                Organization.id == uuid.UUID(org_id_str)
            ).first()
            if org:
                org.stripe_customer_id = session.customer
                org.subscription_id = session.subscription
                org.subscription_status = "active"
                if not org.paid_at:
                    org.paid_at = datetime.now(timezone.utc)
                db.commit()
        except Exception:
            db.rollback()

    @staticmethod
    def _handle_subscription_updated(subscription, db: Session) -> None:
        try:
            org = db.query(Organization).filter(
                Organization.stripe_customer_id == subscription.customer
            ).first()
            if org:
                org.subscription_id = subscription.id
                org.subscription_status = subscription.status
                org.subscription_current_period_end = datetime.fromtimestamp(
                    subscription.current_period_end, tz=timezone.utc
                )
                db.commit()
        except Exception:
            db.rollback()

    @staticmethod
    def _handle_subscription_deleted(subscription, db: Session) -> None:
        try:
            org = db.query(Organization).filter(
                Organization.stripe_customer_id == subscription.customer
            ).first()
            if org:
                org.subscription_status = "canceled"
                org.subscription_current_period_end = datetime.fromtimestamp(
                    subscription.current_period_end, tz=timezone.utc
                )
                db.commit()
        except Exception:
            db.rollback()

    @staticmethod
    def _handle_payment_failed(invoice, db: Session) -> None:
        try:
            org = db.query(Organization).filter(
                Organization.stripe_customer_id == invoice.customer
            ).first()
            if org:
                org.subscription_status = "past_due"
                db.commit()
        except Exception:
            db.rollback()

    # ─────────────────────────────────────────
    # 3. Get billing status for the current org
    # ─────────────────────────────────────────
    @staticmethod
    async def get_billing_status(current_user: SupabaseUser, db: Session) -> dict:
        try:
            org_id = OrgService.get_admin_org_id(current_user, db)
            org = db.query(Organization).filter(Organization.id == org_id).first()
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
