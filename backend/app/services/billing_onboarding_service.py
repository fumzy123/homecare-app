"""Owner consent, hosted card setup, and replay-safe trial activation.

All database queries are repository-owned. This service owns transactions and
Stripe I/O; domain helpers remain pure. All writers lock the organization first.
"""
from app.domain.billing_access import billing_access
from datetime import datetime, timedelta, timezone
from uuid import uuid4
from app.domain.billing_periods import billing_timezones
import stripe
from app.core.stripe_objects import stripe_field as stripe_field, subscription_period_end as subscription_period_end
from app.services.founding_conversion_service import release_conversion_schedule

from app.core.config import settings
from app.core.exceptions import AppError
from app.domain.billing import get_plan
from app.domain.billing_consent import consent_for_plan
from app.domain.founding import offer_available, notice_due_at
from app.repositories.founding_offer_repository import FoundingOfferRepository
from app.repositories.founding_conversion_repository import FoundingConversionRepository
from app.models.billing_agreement import BillingAgreement
from app.models.trial_activation import TrialActivation
from app.domain.billing_access import aware
from app.repositories.billing_agreement_repository import BillingAgreementRepository
from app.repositories.trial_activation_repository import TrialActivationRepository
from math import ceil

stripe.api_key = settings.stripe_secret_key


class BillingOnboardingService:
    def __init__(self, db, current_user=None, org_id=None):
        self.db = db
        self.current_user = current_user
        self.org_id = org_id
        self.agreement_repo = BillingAgreementRepository(db)
        self.trial_activation_repo = TrialActivationRepository(db)
        self.founding_offer_repo = FoundingOfferRepository(db)
        self.conversion_repo = FoundingConversionRepository(db)

    def _lock(self):
        org = self.trial_activation_repo.lock_organization(self.org_id)
        if org is None:
            raise AppError(404, "NOT_FOUND", "Organization not found")
        return org

    @staticmethod
    def _enabled():
        if not settings.billing_onboarding_enabled:
            raise AppError(409, "ONBOARDING_DISABLED", "Billing onboarding is not enabled")

    @staticmethod
    def _price_id(interval, code="standard"):
        if code == "founding":
            return settings.stripe_founding_monthly_v1_price_id
        return (settings.stripe_standard_monthly_v1_price_id if interval == "month"
                else settings.stripe_standard_annual_v1_price_id)

    @staticmethod
    def _check_setup_open(org, agreement):
        if org.subscription_id or agreement.canceled_at:
            raise AppError(409, "AGREEMENT_LOCKED", "Billing authorization is no longer open for card setup")

    def options(self):
        agreement = self.agreement_repo.get_for_org(self.org_id)
        offer = self.founding_offer_repo.get_for_org(self.org_id)
        code = agreement.plan_code if agreement else "founding" if offer_available(offer) else "standard"
        version, text = consent_for_plan(code)
        return {
            "consent_version": version, "consent_text": text,
            "timezones": billing_timezones(),
            "plans": [{
                "code": code, "version": 1, "interval": interval,
                "base_amount_cents": get_plan(code, interval, version=1).base_amount_cents,
                "currency": "cad", "included_clients": 10,
                "additional_client_amount_cents": get_plan(code, interval, version=1).additional_client_amount_cents,
            } for interval in (("month",) if code == "founding" else ("month", "year"))],
        }

    def summary(self, org, *, now=None):
        now = now or datetime.now(timezone.utc)
        agreement = self.agreement_repo.get_for_org(org.id)
        request = self.trial_activation_repo.get_for_org(org.id)
        end = org.trial_ends_at
        access = billing_access(org, now)
        end = access.trial_ends_at
        trial_active = access.is_trial_active
        onboarding = access.is_onboarding
        canceled = bool(agreement and agreement.canceled_at)
        plan = get_plan(agreement.plan_code, agreement.base_interval, version=agreement.plan_version) if agreement else None
        offer = self.founding_offer_repo.get_for_org(org.id)
        conversion = self.conversion_repo.get_for_org(org.id) if agreement and agreement.plan_code == "founding" else None
        if conversion and conversion.status == "converted":
            plan = get_plan("standard", "month", version=conversion.target_plan_version)
        return {
            "new_billing_flow": True,
            "billing_timezone": org.billing_timezone,
            "subscription_status": org.subscription_status,
            "subscription_current_period_end": org.subscription_current_period_end,
            "is_onboarding": onboarding,
            "onboarding_deadline_at": org.onboarding_deadline_at,
            "trial_starts_at": org.trial_starts_at, "trial_ends_at": end,
            "is_trial_active": trial_active,
            "trial_days_left": max(0, ceil((end - now).total_seconds() / 86400)) if trial_active else 0,
            "has_access": access.can_write,
            "can_write": access.can_write,
            "is_read_only": not access.can_write,
            "card_saved": bool(agreement and agreement.payment_method_id),
            "billing_canceled": canceled,
            "activation_status": request.status if request else None,
            "plan_interval": agreement.base_interval if agreement else None,
            "base_amount_cents": plan.base_amount_cents if plan else None,
            "plan_code": plan.code if plan else None,
            "additional_client_amount_cents": plan.additional_client_amount_cents if plan else None,
            "founding_protection_ends_at": offer.protection_ends_at if offer else None,
            "founding_notice_due_at": notice_due_at(offer.protection_ends_at) if offer and offer.protection_ends_at else None,
            "founding_conversion": {
                "status": conversion.status, "notice_at": conversion.notice_at,
                "effective_at": conversion.effective_at, "base_amount_cents": conversion.base_amount_cents,
                "additional_client_amount_cents": conversion.additional_client_amount_cents,
                "included_clients": conversion.included_clients,
            } if conversion else None,
        }

    def setup_card(self, interval, consent_version):
        self._enabled()
        if interval not in ("month", "year"):
            raise AppError(400, "INVALID_TERMS", "Please review the current billing terms")
        now = datetime.now(timezone.utc)
        try:
            org = self._lock()
            if not org.billing_timezone:
                raise AppError(409, "TIMEZONE_REQUIRED", "Save your agency timezone before authorizing billing")
            agreement = self.agreement_repo.get_for_org(org.id)
            offer = self.founding_offer_repo.get_for_org(org.id)
            code = agreement.plan_code if agreement else "founding" if offer_available(offer) else "standard"
            if consent_version != consent_for_plan(code)[0] or (code == "founding" and interval != "month"):
                raise AppError(400, "INVALID_TERMS", "Please review the available plan and current billing terms")
            if org.subscription_id:
                raise AppError(409, "ALREADY_SUBSCRIBED", "Manage the existing subscription in Billing")
            if agreement and (agreement.canceled_at or agreement.base_interval != interval):
                raise AppError(409, "AGREEMENT_LOCKED", "Contact support to change a previously authorized plan")
            if agreement:
                agreement.consent_version = consent_version
                agreement.accepted_at = now
                agreement.accepted_by = self.current_user.id
                self._prepare_purchase(org, now)
                self.db.commit()
                org = self._lock()
                agreement = self.agreement_repo.get_for_org(org.id)
            if agreement is None:
                price_id = self._price_id(interval, code)
                if not price_id:
                    raise AppError(503, "PRICING_NOT_CONFIGURED", "Billing setup is not available yet")
                plan = get_plan(code, interval, version=1)
                price = stripe.Price.retrieve(price_id)
                if (not price.active or price.currency != "cad" or price.unit_amount != plan.base_amount_cents
                        or not price.recurring or price.recurring.interval != interval
                        or price.recurring.interval_count != 1):
                    raise AppError(503, "PRICE_MISMATCH", "Configured pricing does not match the offer")
                agreement = BillingAgreement(
                    id=uuid4(), org_id=org.id, plan_code=code, plan_version=1,
                    base_interval=interval, stripe_price_id=price_id,
                    consent_version=consent_version, accepted_at=now, accepted_by=self.current_user.id,
                )
                self.agreement_repo.add(agreement)
                self._prepare_purchase(org, now)
                self.db.commit()
                org = self._lock()
                agreement = self.agreement_repo.get_for_org(org.id)
            self._check_setup_open(org, agreement)
            if not org.stripe_customer_id:
                if agreement.customer_attempted_at is None:
                    agreement.customer_attempted_at = now
                    self.db.commit()
                    org = self._lock()
                    agreement = self.agreement_repo.get_for_org(org.id)
                    self._check_setup_open(org, agreement)
                if now - agreement.customer_attempted_at >= timedelta(hours=23):
                    raise AppError(409, "RECONCILIATION_REQUIRED", "Support must reconcile the billing account")
                customer = stripe.Customer.create(
                    metadata={"org_id": str(org.id)},
                    idempotency_key=f"onboarding-customer-{agreement.id}",
                )
                org.stripe_customer_id = customer.id
                self.db.commit()
                org = self._lock()
                agreement = self.agreement_repo.get_for_org(org.id)
                self._check_setup_open(org, agreement)
            if agreement.checkout_session_id:
                session = stripe.checkout.Session.retrieve(agreement.checkout_session_id)
                if session.status == "complete":
                    self._save_card(org, agreement, session)
                    self.db.commit()
                    return self.confirm_card()
                if session.status == "open":
                    self.db.commit()
                    return {"url": session.url, "card_saved": False}
            # Setup-only sessions never charge. Expired sessions may be replaced.
            session = stripe.checkout.Session.create(
                mode="setup", currency="cad", customer=org.stripe_customer_id,
                payment_method_types=["card"],
                metadata={"agreement_id": str(agreement.id)},
                success_url=f"{settings.frontend_url}/settings/billing?card_setup=complete",
                cancel_url=f"{settings.frontend_url}/settings/billing?card_setup=cancelled",
                idempotency_key=f"onboarding-setup-{agreement.id}-{agreement.checkout_session_id or 'initial'}",
            )
            agreement.checkout_session_id = session.id
            self.db.commit()
            return {"url": session.url, "card_saved": False}
        except Exception:
            self.db.rollback()
            raise

    @staticmethod
    def _save_card(org, agreement, session):
        if session.customer != org.stripe_customer_id or session.mode != "setup":
            raise AppError(409, "SETUP_MISMATCH", "Card setup does not belong to this account")
        intent = stripe.SetupIntent.retrieve(session.setup_intent)
        if intent.status != "succeeded" or intent.customer != org.stripe_customer_id:
            raise AppError(409, "CARD_NOT_READY", "Finish card verification first")
        stripe.Customer.modify(org.stripe_customer_id, invoice_settings={"default_payment_method": intent.payment_method})
        agreement.payment_method_id = intent.payment_method

    def confirm_card(self):
        self._enabled()
        try:
            org = self._lock()
            agreement = self.agreement_repo.get_for_org(org.id)
            if not agreement or agreement.canceled_at or not agreement.checkout_session_id:
                raise AppError(409, "NO_SETUP", "There is no active card setup")
            if agreement.consent_version != consent_for_plan(agreement.plan_code)[0]:
                raise AppError(409, "CONSENT_REQUIRED", "Review the current plan and select Subscribe before continuing")
            session = stripe.checkout.Session.retrieve(agreement.checkout_session_id)
            if session.status != "complete":
                raise AppError(409, "CARD_NOT_READY", "Finish card setup first")
            self._save_card(org, agreement, session)
            self._prepare_purchase(org, datetime.now(timezone.utc))
            self.db.commit()
            self.process_activation()
            org = self._lock()
            result = {"card_saved": True, "url": None}
            if org.subscription_id and org.subscription_status in ("incomplete", "past_due", "unpaid"):
                sub = stripe.Subscription.retrieve(org.subscription_id)
                if sub.customer != org.stripe_customer_id:
                    raise AppError(409, "SUBSCRIPTION_MISMATCH", "Subscription does not belong to this account")
                request = self.trial_activation_repo.get_for_org(org.id)
                self._sync(org, request, sub)
                invoice_id = stripe_field(sub, "latest_invoice")
                if invoice_id and sub.status in ("incomplete", "past_due", "unpaid"):
                    invoice = stripe.Invoice.retrieve(invoice_id)
                    result["url"] = stripe_field(invoice, "hosted_invoice_url")
            self.db.commit()
            return result
        except Exception:
            self.db.rollback()
            raise

    def _prepare_purchase(self, org, now):
        """Owner authorization enrolls the agency without resetting its free window."""
        request = self.trial_activation_repo.get_for_org(org.id)
        if org.subscription_id or (request and request.stripe_attempted_at):
            return
        if org.onboarding_deadline_at is None:
            start = aware(org.created_at)
            end = start + timedelta(days=14)
            org.onboarding_deadline_at = start
        else:
            start = aware(org.trial_starts_at) or min(
                aware(org.onboarding_completed_at) or aware(org.onboarding_deadline_at),
                aware(org.onboarding_deadline_at))
            end = aware(org.trial_ends_at) or start + timedelta(days=14)
        if request is None:
            request = TrialActivation(id=uuid4(), org_id=org.id, requested_at=now,
                requested_by=self.current_user.id if self.current_user else None, starts_at=start, ends_at=end,
                source="purchase", status="pending")
            self.trial_activation_repo.add(request)
        else:
            request.source = "purchase"
            request.status = "pending"
        # Preserve the local trial while Checkout is open. Paid access still
        # requires a confirmed Stripe status; enrollment alone grants no access.
        org.trial_starts_at = start
        org.trial_ends_at = end

    def process_activation(self, *, now=None):
        self._enabled()
        now = now or datetime.now(timezone.utc)
        try:
            org = self._lock()
            request = self.trial_activation_repo.get_for_org(org.id)
            agreement = self.agreement_repo.get_for_org(org.id)
            if not request or request.status not in ("pending", "awaiting_card"):
                self.db.commit()
                return
            if not agreement or agreement.canceled_at:
                request.status = "canceled" if agreement else "awaiting_card"
                self.db.commit()
                return
            if agreement.plan_code == "founding" and not offer_available(self.founding_offer_repo.get_for_org(org.id)):
                request.status = "needs_review"
                self.db.commit()
                return
            # Reconcile remote success first, including after a local commit failure.
            matching = []
            if org.stripe_customer_id:
                subscriptions = stripe.Subscription.list(customer=org.stripe_customer_id, status="all", limit=100)
                for sub in subscriptions.auto_paging_iter():
                    if stripe_field(sub.metadata, "trial_activation_id") == str(request.id):
                        matching.append(sub)
                    elif sub.status not in ("canceled", "incomplete_expired"):
                        request.status = "needs_review"
                        self.db.commit()
                        return
            if len(matching) > 1:
                request.status = "needs_review"
            elif matching:
                self._sync(org, request, matching[0])
            elif org.subscription_id or (request.ends_at <= now and (getattr(request, "source", None) != "purchase"
                or (request.stripe_attempted_at and request.ends_at > request.stripe_attempted_at))) or (
                request.stripe_attempted_at and now - request.stripe_attempted_at >= timedelta(hours=23)
            ):
                request.status = "needs_review"
            else:
                if not org.billing_timezone:
                    request.status = "needs_review"
                    self.db.commit()
                    return
                if not agreement.payment_method_id and agreement.checkout_session_id:
                    session = stripe.checkout.Session.retrieve(agreement.checkout_session_id)
                    if session.status == "complete":
                        self._save_card(org, agreement, session)
                if not agreement.payment_method_id or not org.stripe_customer_id:
                    request.status = "awaiting_card"
                    self.db.commit()
                    return
                if request.stripe_attempted_at is None:
                    request.stripe_attempted_at = now
                    self.db.commit()
                    # Re-enter under the org lock and recheck cancellation/remote state.
                    return self.process_activation(now=now)
                trial = {"trial_end": int(request.ends_at.timestamp()),
                    "trial_settings": {"end_behavior": {"missing_payment_method": "cancel"}}} if request.ends_at > request.stripe_attempted_at else {}
                sub = stripe.Subscription.create(
                    customer=org.stripe_customer_id,
                    items=[{"price": agreement.stripe_price_id}],
                    default_payment_method=agreement.payment_method_id,
                    **trial,
                    payment_behavior="default_incomplete",
                    metadata={"trial_activation_id": str(request.id), "org_id": str(org.id)},
                    idempotency_key=f"trial-activation-{request.id}",
                )
                self._sync(org, request, sub)
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise

    @staticmethod
    def _sync(org, request, sub):
        org.subscription_id = sub.id
        org.subscription_status = sub.status
        org.trial_starts_at = request.starts_at
        # Immediate subscriptions need a paid-usage anchor too. Never bill for
        # the gap between an expired trial and the customer's actual purchase.
        org.trial_ends_at = datetime.fromtimestamp(sub.trial_end or sub.start_date, timezone.utc)
        org.subscription_current_period_end = subscription_period_end(sub)
        request.status = "activated" if sub.status != "canceled" else "canceled"

    def cancel(self):
        try:
            org = self._lock()
            agreement = self.agreement_repo.get_for_org(org.id)
            if not agreement:
                raise AppError(409, "NO_AGREEMENT", "There is no billing agreement to cancel")
            agreement.canceled_at = agreement.canceled_at or datetime.now(timezone.utc)
            offer = self.founding_offer_repo.get_for_org(org.id)
            if offer:
                offer.forfeited_at = offer.forfeited_at or agreement.canceled_at
            request = self.trial_activation_repo.get_for_org(org.id)
            # Search also catches a successful Stripe create followed by local failure.
            if org.stripe_customer_id:
                for sub in stripe.Subscription.list(customer=org.stripe_customer_id, status="all", limit=100).auto_paging_iter():
                    if sub.id == org.subscription_id or (request and stripe_field(sub.metadata, "trial_activation_id") == str(request.id)):
                        if sub.status not in ("canceled", "incomplete_expired"):
                            release_conversion_schedule(self.conversion_repo.get_for_org(org.id), sub)
                            stripe.Subscription.modify(sub.id, cancel_at_period_end=True)
                        org.subscription_id = sub.id
            if request:
                request.status = "canceled"
            self.db.commit()
            return {"canceled": True}
        except Exception:
            self.db.rollback()
            raise
