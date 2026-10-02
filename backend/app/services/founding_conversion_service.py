"""Publish immutable notices and arrange renewal changes under the agency lock."""
from datetime import datetime, timedelta, timezone
from uuid import uuid4
import logging
import stripe

from app.core.config import settings
from app.core.enums import NotificationType
from app.core.exceptions import AppError
from app.domain.billing import get_plan, current_plan_version
from app.services.billing_prices import price_id as configured_price_id
from app.domain.founding import conversion_boundary, offer_available
from app.models.founding_conversion import FoundingConversion
from app.repositories.billing_agreement_repository import BillingAgreementRepository
from app.repositories.founding_conversion_repository import FoundingConversionRepository
from app.repositories.founding_offer_repository import FoundingOfferRepository
from app.repositories.notification_repository import NotificationRepository
from app.repositories.trial_activation_repository import TrialActivationRepository
from app.core.stripe_objects import stripe_field

logger = logging.getLogger(__name__)


def price_id(subscription):
    items = stripe_field(stripe_field(subscription, "items", {}), "data", [])
    if len(items) != 1 or stripe_field(items[0], "quantity", 1) != 1:
        return None
    return stripe_field(stripe_field(items[0], "price", {}), "id")


def reconcile_conversion(conversion, subscription, now):
    """Caller owns the agency lock; time alone never confirms a price change."""
    if (not conversion or conversion.subscription_id != subscription.id
            or price_id(subscription) != conversion.target_price_id):
        return False
    if (now >= conversion.effective_at and stripe_field(
            stripe_field(subscription, "metadata", {}), "founding_conversion_id") == str(conversion.id)):
        conversion.status = "converted"
        conversion.converted_at = conversion.effective_at
    else:
        conversion.status = "needs_review"
        logger.error("Unexpected founding price change for organization %s", conversion.org_id)
    return True


def release_conversion_schedule(conversion, subscription):
    """Caller owns the agency lock and commits alongside cancellation."""
    if not conversion:
        return
    schedule_id = stripe_field(subscription, "schedule")
    if schedule_id:
        schedule = stripe.SubscriptionSchedule.retrieve(schedule_id)
        owned = schedule.id == conversion.schedule_id or stripe_field(
            stripe_field(schedule, "metadata", {}), "founding_conversion_id"
        ) == str(conversion.id)
        if not owned and conversion.attempted_at and datetime.now(timezone.utc) - conversion.attempted_at < timedelta(hours=23):
            recovered = stripe.SubscriptionSchedule.create(
                from_subscription=subscription.id, idempotency_key=f"founding-schedule-{conversion.id}",
            )
            owned = recovered.id == schedule.id
        if not owned:
            raise AppError(409, "SCHEDULE_REVIEW_REQUIRED", "Support must reconcile this subscription schedule")
        if schedule.status == "active":
            stripe.SubscriptionSchedule.release(schedule.id, preserve_cancel_date=True)
    if (price_id(subscription) == conversion.target_price_id
            and stripe_field(stripe_field(subscription, "metadata", {}), "founding_conversion_id") == str(conversion.id)):
        conversion.status = "converted"
        conversion.converted_at = conversion.effective_at
    elif conversion.status != "converted":
        conversion.status = "canceled"


class FoundingConversionService:
    def __init__(self, db):
        self.db = db
        self.trial_activation_repo = TrialActivationRepository(db)
        self.agreement_repo = BillingAgreementRepository(db)
        self.founding_offer_repo = FoundingOfferRepository(db)
        self.conversion_repo = FoundingConversionRepository(db)
        self.notification_repo = NotificationRepository(db)

    def process(self, org_id, *, now=None):
        if not settings.billing_onboarding_enabled:
            return
        now = now or datetime.now(timezone.utc)
        try:
            org = self.trial_activation_repo.lock_organization(org_id)
            if not org or not org.subscription_id or org.onboarding_deadline_at is None:
                self.db.commit()
                return
            offer = self.founding_offer_repo.get_for_org(org_id)
            agreement = self.agreement_repo.get_for_org(org_id)
            conversion = self.conversion_repo.get_for_org(org_id)
            if not agreement or agreement.plan_code != "founding" or not offer or not offer.protection_ends_at:
                self.db.commit()
                return
            if conversion and conversion.status in ("converted", "canceled", "needs_review"):
                self.db.commit()
                return
            sub = stripe.Subscription.retrieve(org.subscription_id)
            if sub.customer != org.stripe_customer_id or (conversion and conversion.subscription_id != sub.id):
                raise AppError(409, "SUBSCRIPTION_MISMATCH", "Support must reconcile the billing account")
            if (not offer_available(offer) or agreement.canceled_at or sub.status in ("canceled", "incomplete_expired")
                    or stripe_field(sub, "cancel_at_period_end") or stripe_field(sub, "cancel_at")):
                release_conversion_schedule(conversion, sub)
                self.db.commit()
                return
            if reconcile_conversion(conversion, sub, now):
                self.db.commit()
                return
            if sub.status != "active":
                self.db.commit()
                return
            if price_id(sub) != agreement.stripe_price_id:
                raise AppError(409, "PRICE_MISMATCH", "The subscription no longer matches its founding agreement")
            if conversion is None:
                # Start early enough that the regular 15-minute polling delay
                # never shortens the promised 30 days at the normal anniversary.
                if now < offer.protection_ends_at - timedelta(days=45):
                    self.db.commit()
                    return
                if stripe_field(sub, "schedule"):
                    raise AppError(409, "SCHEDULE_REVIEW_REQUIRED", "An existing schedule needs operator review")
                conversion = self._announce(org, offer, sub, now)
                self.db.commit()
                # Reacquire and recheck cancellation after publishing the notice.
                return self.process(org_id, now=now)
            self._schedule(conversion, sub, agreement, now)
            if conversion.status == "needs_review":
                logger.error("Founding conversion requires operator review for organization %s", org_id)
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise

    def _announce(self, org, offer, sub, now):
        plan = get_plan("standard", "month", version=current_plan_version("standard"))
        target = configured_price_id("standard", "month", plan.version)
        if not target:
            raise AppError(503, "PRICING_NOT_CONFIGURED", "Standard pricing is not configured")
        price = stripe.Price.retrieve(target)
        if (not price.active or price.currency != "cad" or price.unit_amount != plan.base_amount_cents
                or not price.recurring or price.recurring.interval != "month" or price.recurring.interval_count != 1):
            raise AppError(503, "PRICE_MISMATCH", "Standard pricing does not match the catalog")
        anchor = datetime.fromtimestamp(sub.billing_cycle_anchor, timezone.utc)
        conversion = FoundingConversion(
            id=uuid4(), org_id=org.id, subscription_id=sub.id, target_price_id=target,
            target_plan_version=plan.version, base_amount_cents=plan.base_amount_cents,
            additional_client_amount_cents=plan.additional_client_amount_cents, included_clients=plan.included_clients,
            notice_at=now, effective_at=conversion_boundary(anchor, offer.protection_ends_at, now), status="pending",
        )
        self.conversion_repo.add(conversion)
        notification = self.notification_repo.create(
            org_id=org.id, type=NotificationType.founding_conversion_notice, requires_action=False,
            payload={"conversion_id": str(conversion.id), "effective_at": conversion.effective_at.isoformat(),
                     "currency": "CAD", "base_amount_cents": conversion.base_amount_cents,
                     "additional_client_amount_cents": conversion.additional_client_amount_cents,
                     "included_clients": conversion.included_clients},
        )
        self.notification_repo.create_reads_for_admins(notification.id, org.id)
        return conversion

    def _schedule(self, conversion, sub, agreement, now):
        remote_id = stripe_field(sub, "schedule")
        schedule = stripe.SubscriptionSchedule.retrieve(remote_id) if remote_id else None
        if schedule:
            owned = schedule.id == conversion.schedule_id or stripe_field(
                stripe_field(schedule, "metadata", {}), "founding_conversion_id"
            ) == str(conversion.id)
            # A create that succeeded before a local failure is recovered by
            # repeating the same create key within its safe retry window below.
            if not owned:
                if conversion.attempted_at and now - conversion.attempted_at < timedelta(hours=23):
                    recovered = stripe.SubscriptionSchedule.create(
                        from_subscription=sub.id, idempotency_key=f"founding-schedule-{conversion.id}",
                    )
                    owned = recovered.id == schedule.id
                if not owned:
                    conversion.status = "needs_review"
                    return
            conversion.schedule_id = schedule.id
            phases = stripe_field(schedule, "phases", [])
            if any(stripe_field(stripe_field(p, "metadata", {}), "founding_conversion_id") == str(conversion.id)
                   and stripe_field(p, "start_date") == int(conversion.effective_at.timestamp())
                   and len(stripe_field(p, "items", [])) == 1
                   and stripe_field(p["items"][0], "price") == conversion.target_price_id
                   and stripe_field(p["items"][0], "quantity") == 1
                   for p in phases):
                conversion.status = "scheduled"
                return
        if conversion.status == "scheduled" or now >= conversion.effective_at:
            # Never recreate an externally removed schedule or backdate a charge.
            conversion.status = "needs_review"
            return
        if schedule is None:
            if conversion.attempted_at is None:
                conversion.attempted_at = now
                self.db.commit()
                return self.process(conversion.org_id, now=now)
            if now - conversion.attempted_at >= timedelta(hours=23):
                conversion.status = "needs_review"
                return
            schedule = stripe.SubscriptionSchedule.create(
                from_subscription=sub.id, idempotency_key=f"founding-schedule-{conversion.id}",
            )
            conversion.schedule_id = schedule.id
        # We only automate the simple base subscription produced by onboarding.
        # Preserve custom deals by refusing to overwrite unknown phase settings.
        phases = stripe_field(schedule, "phases", [])
        if schedule.status != "active" or len(phases) != 1 or any(
            stripe_field(phases[0], key) for key in ("discounts", "add_invoice_items", "default_tax_rates", "transfer_data")
        ) or any(stripe_field(item, "tax_rates") or stripe_field(item, "discounts")
                 for item in stripe_field(phases[0], "items", [])):
            conversion.status = "needs_review"
            return
        stripe.SubscriptionSchedule.modify(
            schedule.id, end_behavior="release", proration_behavior="none",
            metadata={"founding_conversion_id": str(conversion.id)},
            phases=[
                {"start_date": phases[0].start_date, "end_date": int(conversion.effective_at.timestamp()),
                 "items": [{"price": agreement.stripe_price_id, "quantity": 1}], "proration_behavior": "none"},
                {"start_date": int(conversion.effective_at.timestamp()), "duration": {"interval": "month", "interval_count": 1},
                 "items": [{"price": conversion.target_price_id, "quantity": 1}], "proration_behavior": "none",
                 "metadata": {"founding_conversion_id": str(conversion.id)}},
            ], idempotency_key=f"founding-phases-{conversion.id}",
        )
        conversion.status = "scheduled"
