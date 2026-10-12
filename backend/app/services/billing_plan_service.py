"""Self-service Standard interval changes; Stripe schedules own renewal timing."""
import hashlib
import hmac
import json
from uuid import uuid4
from datetime import datetime, timezone
from dateutil.relativedelta import relativedelta

import stripe
from app.core.config import settings
from app.core.exceptions import AppError
from app.core.stripe_objects import stripe_field, subscription_period_end
from app.domain.billing import get_plan, current_plan_version
from app.services.billing_prices import price_id, standard_prices
from app.repositories.organization_repository import OrganizationRepository
from app.repositories.billing_agreement_repository import BillingAgreementRepository


def reconcile_standard_plan(agreement, sub):
    """Only reconcile changes explicitly made by this application, under org lock."""
    if not agreement or agreement.plan_code != "standard":
        return
    interval = stripe_field(stripe_field(sub, "metadata", {}), "careharbor_interval")
    if interval not in ("month", "year"):
        return
    items = stripe_field(stripe_field(sub, "items", {}), "data", [])
    if len(items) != 1 or stripe_field(items[0], "quantity") != 1:
        return
    price = stripe_field(stripe_field(items[0], "price", {}), "id")
    prices = standard_prices()
    if price in prices and prices[price][0] == interval:
        agreement.base_interval, agreement.stripe_price_id = interval, price
        agreement.plan_version = prices[price][1]


def release_plan_schedule(sub):
    schedule_id = stripe_field(sub, "schedule")
    if not schedule_id:
        return
    schedule = stripe.SubscriptionSchedule.retrieve(schedule_id)
    if stripe_field(stripe_field(schedule, "metadata", {}), "careharbor_subscription") == sub.id:
        stripe.SubscriptionSchedule.release(schedule.id, preserve_cancel_date=True)
        return True


class BillingPlanService:
    def __init__(self, db, current_user, org_id):
        self.db, self.current_user, self.org_id = db, current_user, org_id
        self.org_repo = OrganizationRepository(db)
        self.agreement_repo = BillingAgreementRepository(db)

    def _load(self):
        org = self.org_repo.lock_by_id(self.org_id)
        if not org or not org.subscription_id:
            raise AppError(409, "NO_SUBSCRIPTION", "Choose a plan to subscribe first")
        sub = stripe.Subscription.retrieve(org.subscription_id)
        if sub.customer != org.stripe_customer_id:
            raise AppError(409, "SUBSCRIPTION_MISMATCH", "Subscription needs review")
        agreement = self.agreement_repo.get_for_org(org.id)
        reconcile_standard_plan(agreement, sub)
        return org, agreement, sub

    def _terms(self, org, agreement, sub, interval):
        if not agreement or agreement.plan_code != "standard":
            raise AppError(409, "PROTECTED_PLAN", "Your Founding offer has its own protected billing schedule")
        if agreement.canceled_at or stripe_field(sub, "cancel_at_period_end") or sub.status not in ("trialing", "active"):
            raise AppError(409, "SUBSCRIPTION_NOT_READY", "Resolve the subscription status before changing your plan")
        if agreement.base_interval == interval:
            raise AppError(409, "CURRENT_PLAN", "You already have this plan")
        items = stripe_field(stripe_field(sub, "items", {}), "data", [])
        if len(items) != 1 or stripe_field(items[0], "quantity") != 1 or stripe_field(stripe_field(items[0], "price", {}), "id") != agreement.stripe_price_id:
            raise AppError(409, "PRICE_MISMATCH", "Subscription pricing needs review")
        plan = get_plan("standard", interval, version=current_plan_version("standard"))
        target_price = price_id("standard", interval, plan.version)
        price = stripe.Price.retrieve(target_price)
        if not price.active or price.currency != "cad" or price.unit_amount != plan.base_amount_cents or not price.recurring or price.recurring.interval != interval or price.recurring.interval_count != 1:
            raise AppError(503, "PRICE_MISMATCH", "Pricing is temporarily unavailable")
        end = subscription_period_end(sub)
        if not end or end <= datetime.now(timezone.utc):
            raise AppError(409, "PERIOD_CHANGED", "Your billing period is updating. Please try again shortly")
        anchor = org.trial_ends_at
        if anchor and sub.status != "trialing":
            months = (end.year - anchor.year) * 12 + end.month - anchor.month
            duration = 12 if interval == "year" else 1
            if end.day != anchor.day or end + relativedelta(months=duration) != anchor + relativedelta(months=months + duration):
                raise AppError(409, "CALENDAR_REVIEW", "This change needs a billing-date adjustment. Please contact support")
        return {"org_id": str(org.id), "subscription_id": sub.id, "interval": interval,
            "price_id": target_price, "current_price_id": agreement.stripe_price_id,
            "effective_at": int(end.timestamp()), "trial": sub.status == "trialing",
            "base_amount_cents": plan.base_amount_cents,
            "additional_client_amount_cents": plan.additional_client_amount_cents,
            "included_clients": plan.included_clients, "plan_version": plan.version, "due_now_cents": 0, "currency": "cad"}

    @staticmethod
    def _signature(payload):
        return hmac.new(settings.stripe_secret_key.encode(), json.dumps(payload, sort_keys=True).encode(), hashlib.sha256).hexdigest()

    def preview(self, interval):
        try:
            org, agreement, sub = self._load()
            if stripe_field(sub, "schedule"):
                schedule = stripe.SubscriptionSchedule.retrieve(sub.schedule)
                owned = stripe_field(stripe_field(schedule, "metadata", {}), "careharbor_subscription") == sub.id
                future = any(stripe_field(phase, "start_date", 0) > datetime.now(timezone.utc).timestamp() for phase in schedule.phases)
                if not owned or future:
                    raise AppError(409, "CHANGE_PENDING", "A plan change is already scheduled")
                stripe.SubscriptionSchedule.release(schedule.id, preserve_cancel_date=True)
                sub = stripe.Subscription.retrieve(sub.id)
            result = self._terms(org, agreement, sub, interval)
            result["expires_at"] = int(datetime.now(timezone.utc).timestamp()) + 900
            result["request_id"] = str(uuid4())
            result["token"] = self._signature(result)
            self.db.commit()
            return result
        except Exception:
            self.db.rollback()
            raise

    def change(self, quote):
        try:
            quote = dict(quote)
            signature = quote.pop("token", "")
            if not hmac.compare_digest(signature, self._signature(quote)) or quote.get("org_id") != str(self.org_id):
                raise AppError(400, "INVALID_PREVIEW", "Review your plan change again")
            if quote.get("expires_at", 0) <= datetime.now(timezone.utc).timestamp():
                raise AppError(409, "PREVIEW_EXPIRED", "Review your plan change again")
            org, agreement, sub = self._load()
            if sub.id != quote["subscription_id"]:
                raise AppError(409, "SUBSCRIPTION_CHANGED", "Review your current subscription again")
            if agreement.base_interval == quote["interval"]:
                self.db.commit()
                return {"scheduled": False}
            terms = self._terms(org, agreement, sub, quote["interval"])
            if any(quote.get(key) != value for key, value in terms.items()):
                raise AppError(409, "PREVIEW_CHANGED", "Billing details changed. Please review the updated amount")
            metadata = {"careharbor_interval": quote["interval"], "careharbor_plan_request": quote["request_id"],
                        "careharbor_plan_owner": str(self.current_user.id)}
            if quote["trial"]:
                if stripe_field(sub, "schedule"):
                    raise AppError(409, "CHANGE_PENDING", "A plan change is already scheduled")
                item = stripe_field(stripe_field(sub, "items"), "data")[0]
                changed = stripe.Subscription.modify(sub.id, items=[{"id": item.id, "price": quote["price_id"]}],
                    proration_behavior="none", payment_behavior="error_if_incomplete", metadata=metadata,
                    idempotency_key=f"plan-trial-{signature}")
                reconcile_standard_plan(agreement, changed)
            else:
                schedule_id = stripe_field(sub, "schedule")
                schedule = stripe.SubscriptionSchedule.retrieve(schedule_id) if schedule_id else stripe.SubscriptionSchedule.create(
                    from_subscription=sub.id, idempotency_key=f"plan-schedule-{signature}")
                owner = stripe_field(stripe_field(schedule, "metadata", {}), "careharbor_subscription")
                if owner != sub.id:
                    recovered = stripe.SubscriptionSchedule.create(from_subscription=sub.id, idempotency_key=f"plan-schedule-{signature}")
                    if recovered.id != schedule.id:
                        raise AppError(409, "SCHEDULE_MISMATCH", "An existing schedule needs review")
                elif stripe_field(stripe_field(schedule, "metadata", {}), "quote") != signature:
                    raise AppError(409, "CHANGE_PENDING", "A plan change is already scheduled")
                phase = schedule.phases[0]
                current = {key: stripe_field(phase, key) for key in (
                    "start_date", "default_payment_method", "default_tax_rates", "discounts", "collection_method", "automatic_tax",
                ) if stripe_field(phase, key) is not None}
                current.update(items=[{"price": quote["current_price_id"], "quantity": 1}], end_date=quote["effective_at"], proration_behavior="none")
                stripe.SubscriptionSchedule.modify(schedule.id, end_behavior="release", proration_behavior="none",
                    metadata={"careharbor_subscription": sub.id, "quote": signature}, phases=[current, {
                        "items": [{"price": quote["price_id"], "quantity": 1}], "start_date": quote["effective_at"],
                        "duration": {"interval": quote["interval"], "interval_count": 1},
                        "proration_behavior": "none", "metadata": metadata,
                    }], idempotency_key=f"plan-phases-{signature}")
            self.db.commit()
            return {"scheduled": not quote["trial"]}
        except Exception:
            self.db.rollback()
            raise

    def pending(self):
        try:
            _, _, sub = self._load()
            result = None
            if stripe_field(sub, "schedule"):
                schedule = stripe.SubscriptionSchedule.retrieve(sub.schedule)
                if stripe_field(stripe_field(schedule, "metadata", {}), "careharbor_subscription") == sub.id:
                    for phase in schedule.phases:
                        interval = stripe_field(stripe_field(phase, "metadata", {}), "careharbor_interval")
                        if interval and phase.start_date > datetime.now(timezone.utc).timestamp():
                            result = {"interval": interval, "effective_at": phase.start_date}
            self.db.commit()
            return {"pending": result}
        except Exception:
            self.db.rollback()
            raise

    def cancel_pending(self):
        try:
            _, _, sub = self._load()
            if stripe_field(sub, "schedule"):
                schedule = stripe.SubscriptionSchedule.retrieve(sub.schedule)
                if stripe_field(stripe_field(schedule, "metadata", {}), "careharbor_subscription") != sub.id:
                    raise AppError(409, "SCHEDULE_MISMATCH", "This schedule needs review")
                if not any(stripe_field(stripe_field(phase, "metadata", {}), "careharbor_interval")
                           and phase.start_date > datetime.now(timezone.utc).timestamp() for phase in schedule.phases):
                    raise AppError(409, "CHANGE_APPLIED", "The plan change has already taken effect")
                stripe.SubscriptionSchedule.release(schedule.id, preserve_cancel_date=True)
            self.db.commit()
            return {"ok": True}
        except Exception:
            self.db.rollback()
            raise
