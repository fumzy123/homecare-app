from datetime import datetime, timedelta, timezone
import stripe
from app.core.stripe_objects import stripe_field
from app.core.config import settings
from app.core.enums import NotificationType
from app.models.billing_notice import BillingNotice
from app.repositories.billing_notice_repository import BillingNoticeRepository
from app.repositories.notification_repository import NotificationRepository
from app.repositories.organization_repository import OrganizationRepository
from app.repositories.billing_agreement_repository import BillingAgreementRepository


def utc(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


class BillingNoticeService:
    def __init__(self, db):
        self.db = db
        self.notice_repo = BillingNoticeRepository(db)
        self.notification_repo = NotificationRepository(db)
        self.org_repo = OrganizationRepository(db)
        self.agreement_repo = BillingAgreementRepository(db)

    def _create(self, org_id, key, kind, payload, now, requires_action=False):
        if self.notice_repo.get(key):
            return False
        notification = self.notification_repo.create(org_id=org_id, type=kind,
            payload=payload, requires_action=requires_action)
        self.notification_repo.create_reads_for_admins(notification.id, org_id)
        self.notice_repo.add(BillingNotice(key=key, org_id=org_id, notification_id=notification.id, created_at=now))
        return True

    def trial_reminder(self, org_id, now=None):
        if not settings.billing_notifications_enabled:
            return False
        now = now or datetime.now(timezone.utc)
        try:
            org = self.org_repo.lock_by_id(org_id)
            if not org or org.deleted_at or not org.is_active or not org.onboarding_deadline_at or org.subscription_status != "trialing" or not org.trial_ends_at or not org.subscription_id:
                self.db.commit()
                return False
            end = utc(org.trial_ends_at)
            remaining = end - now
            if not timedelta(0) < remaining <= timedelta(days=3):
                self.db.commit()
                return False
            # If the scheduler missed the three-day window, send only the more
            # relevant one-day reminder, never both at once.
            days = 1 if remaining <= timedelta(days=1) else 3
            key = f"trial:{org_id}:{end.isoformat()}:{days}"
            if self.notice_repo.get(key):
                self.db.commit()
                return False
            agreement = self.agreement_repo.get_for_org(org_id)
            if not agreement:
                self.db.commit()
                return False
            subscription = stripe.Subscription.retrieve(org.subscription_id)
            if subscription.customer != org.stripe_customer_id or subscription.status != "trialing" or subscription.trial_end != int(end.timestamp()):
                self.db.commit()
                return False
            canceled = bool(agreement.canceled_at or stripe_field(subscription, "cancel_at_period_end") or stripe_field(subscription, "cancel_at"))
            created = self._create(org_id, key,
                NotificationType.billing_trial_reminder,
                {"trial_ends_at": end.isoformat(), "renewal_canceled": canceled}, now)
            self.db.commit()
            return created
        except Exception:
            self.db.rollback()
            raise

    def payment_status(self, invoice):
        if not settings.billing_notifications_enabled:
            return
        now = datetime.now(timezone.utc)
        try:
            org = self.org_repo.lock_by_stripe_customer_id(invoice.customer)
            if not org or org.deleted_at:
                self.db.commit()
                return
            # Re-read under the agency lock: a stale failed delivery must not
            # recreate an alert after a paid delivery has already resolved it.
            invoice = stripe.Invoice.retrieve(invoice.id)
            if invoice.customer != org.stripe_customer_id:
                raise ValueError("Invoice customer mismatch")
            key = f"payment:{org.id}:{invoice.id}"
            if invoice.status in ("open", "uncollectible"):
                self._create(org.id, key, NotificationType.billing_payment_failed,
                    {"invoice_id": invoice.id}, now, requires_action=True)
            elif invoice.status in ("paid", "void"):
                notice = self.notice_repo.get(key)
                notification = self.notification_repo.get_by_id(notice.notification_id) if notice and notice.notification_id else None
                if notification and notification.resolved_at is None:
                    notification.resolved_at = now
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise
