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


class PaymentService:

    # ─────────────────────────────────────────
    # 1. Create Stripe Checkout Session
    # Returns a hosted payment URL to redirect the user to
    # ─────────────────────────────────────────
    @staticmethod
    async def create_checkout_session(current_user: SupabaseUser, db: Session) -> dict:
        try:
            org_id = OrgService.get_admin_org_id(current_user, db)
            org = db.query(Organization).filter(Organization.id == org_id).first()
            if not org:
                raise AppError(404, "NOT_FOUND", "Organization not found")

            if org.paid_at:
                raise AppError(400, "ALREADY_PAID", "This organization already has lifetime access")

            session = stripe.checkout.Session.create(
                mode="payment",
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
    # Verifies signature — only grants access after confirmed payment
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

        if event["type"] == "checkout.session.completed":
            session = event["data"]["object"]
            metadata = session.metadata
            org_id_str = metadata["org_id"] if metadata else None
            customer_id = session.customer

            if org_id_str:
                try:
                    org = db.query(Organization).filter(
                        Organization.id == uuid.UUID(org_id_str)
                    ).first()
                    if org and not org.paid_at:
                        org.paid_at = datetime.now(timezone.utc)
                        org.stripe_customer_id = customer_id
                        db.commit()
                except Exception:
                    db.rollback()

        return {"received": True}

    # ─────────────────────────────────────────
    # 3. Get payment status for the current org
    # ─────────────────────────────────────────
    @staticmethod
    async def get_payment_status(current_user: SupabaseUser, db: Session) -> dict:
        try:
            org_id = OrgService.get_admin_org_id(current_user, db)
            org = db.query(Organization).filter(Organization.id == org_id).first()
            if not org:
                raise AppError(404, "NOT_FOUND", "Organization not found")

            # Trial Calculation (14 days from creation)
            trial_duration = 14
            now = datetime.now(timezone.utc)
            
            # Ensure org.created_at has timezone info
            created_at = org.created_at
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            
            trial_ends_at = created_at + timedelta(days=trial_duration)
            is_trial_active = now < trial_ends_at
            days_left = max(0, (trial_ends_at - now).days)

            return {
                "has_paid": org.paid_at is not None,
                "paid_at": org.paid_at,
                "is_trial_active": is_trial_active,
                "trial_days_left": days_left,
                "trial_ends_at": trial_ends_at,
            }

        except AppError:
            raise
        except Exception as e:
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))
