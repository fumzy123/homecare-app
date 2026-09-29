from fastapi import APIRouter, Depends, Request, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import require_admin
from app.services.billing_service import BillingService
from app.services.org_service import OrgService
from uuid import UUID
from app.core.security import require_billing_operator
from app.services.trial_activation_service import TrialActivationService
from app.services.billing_onboarding_service import BillingOnboardingService
from app.core.security import require_owner
from typing import Literal
from app.services.founding_offer_service import FoundingOfferService
from app.services.billing_usage_service import BillingUsageService
from app.services.billing_adjustment_service import BillingAdjustmentService
from app.services.billing_upcoming_service import BillingUpcomingService
from app.services.billing_operator_service import BillingOperatorService
from app.services.billing_profile_service import BillingProfileService
from app.services.billing_plan_service import BillingPlanService

router = APIRouter(prefix="/billing", tags=["Billing"])


def get_billing_plan_service(current_user=Depends(require_owner), db: Session = Depends(get_db)):
    return BillingPlanService(db, current_user, OrgService.get_user_org_id(current_user, db))


class PlanIntervalPayload(BaseModel):
    interval: Literal["month", "year"]


class PlanQuotePayload(PlanIntervalPayload):
    org_id: str = Field(max_length=36)
    subscription_id: str = Field(max_length=255)
    price_id: str = Field(max_length=255)
    current_price_id: str = Field(max_length=255)
    effective_at: int
    trial: bool
    base_amount_cents: int
    due_now_cents: Literal[0]
    currency: Literal["cad"]
    expires_at: int
    request_id: str = Field(max_length=36)
    token: str = Field(pattern=r"^[a-f0-9]{64}$")


@router.post('/plan/preview')
def preview_billing_plan(payload: PlanIntervalPayload, billing_plan_service: BillingPlanService = Depends(get_billing_plan_service)):
    return billing_plan_service.preview(payload.interval)


@router.post('/plan/change')
def change_billing_plan(payload: PlanQuotePayload, billing_plan_service: BillingPlanService = Depends(get_billing_plan_service)):
    return billing_plan_service.change(payload.model_dump())


@router.get('/plan/pending')
def pending_billing_plan(billing_plan_service: BillingPlanService = Depends(get_billing_plan_service)):
    return billing_plan_service.pending()


@router.delete('/plan/pending')
def cancel_pending_billing_plan(billing_plan_service: BillingPlanService = Depends(get_billing_plan_service)):
    return billing_plan_service.cancel_pending()


def get_billing_profile_service(current_user=Depends(require_owner), db: Session = Depends(get_db)):
    return BillingProfileService(db, current_user, OrgService.get_user_org_id(current_user, db))


class BillingAddressPayload(BaseModel):
    line1: str = Field(default="", max_length=200)
    line2: str = Field(default="", max_length=200)
    city: str = Field(default="", max_length=100)
    state: str = Field(default="", max_length=100)
    postal_code: str = Field(default="", max_length=30)
    country: str = Field(pattern=r"^[A-Z]{2}$")


class BillingProfilePayload(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: str = Field(min_length=3, max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    address: BillingAddressPayload


class ConfirmPaymentSetupPayload(BaseModel):
    setup_intent_id: str = Field(min_length=1, max_length=255)


@router.post('/payment-methods/confirm')
def confirm_payment_setup(payload: ConfirmPaymentSetupPayload, billing_profile_service: BillingProfileService = Depends(get_billing_profile_service)):
    return billing_profile_service.confirm_setup(payload.setup_intent_id)


@router.get('/profile')
def billing_profile(billing_profile_service: BillingProfileService = Depends(get_billing_profile_service)):
    return billing_profile_service.read()


@router.put('/profile')
def update_billing_profile(payload: BillingProfilePayload, billing_profile_service: BillingProfileService = Depends(get_billing_profile_service)):
    return billing_profile_service.update(payload.model_dump())


@router.delete('/payment-methods/{payment_method_id}')
def remove_billing_card(payment_method_id: str, billing_profile_service: BillingProfileService = Depends(get_billing_profile_service)):
    return billing_profile_service.card(payment_method_id, remove=True)


def get_billing_operator_service(current_user=Depends(require_billing_operator), db: Session = Depends(get_db)):
    return BillingOperatorService(db, current_user)


@router.get('/operator/access')
def billing_operator_access(billing_operator_service: BillingOperatorService = Depends(get_billing_operator_service)):
    return billing_operator_service.access()


@router.get('/operator/organizations')
def billing_operator_agencies(search: str = Query('', max_length=100), before: UUID | None = None,
    billing_operator_service: BillingOperatorService = Depends(get_billing_operator_service)):
    return billing_operator_service.agencies(search, before)


@router.get('/operator/webhooks')
def billing_operator_webhooks(billing_operator_service: BillingOperatorService = Depends(get_billing_operator_service)):
    return billing_operator_service.webhooks()


@router.get('/operator/organizations/{org_id}')
def billing_operator_agency(org_id: UUID, billing_operator_service: BillingOperatorService = Depends(get_billing_operator_service)):
    return billing_operator_service.agency(org_id)


@router.get('/operator/organizations/{org_id}/periods')
def billing_operator_periods(org_id: UUID, before: UUID | None = None,
    billing_operator_service: BillingOperatorService = Depends(get_billing_operator_service)):
    return billing_operator_service.periods(org_id, before)


@router.get('/operator/organizations/{org_id}/periods/{period_id}/settlements')
def billing_operator_settlements(org_id: UUID, period_id: UUID,
    billing_operator_service: BillingOperatorService = Depends(get_billing_operator_service)):
    return billing_operator_service.settlements(org_id, period_id)


@router.post('/operator/organizations/{org_id}/recheck')
def billing_operator_recheck(org_id: UUID, billing_operator_service: BillingOperatorService = Depends(get_billing_operator_service)):
    return billing_operator_service.recheck(org_id)


def get_billing_upcoming_service(current_user=Depends(require_admin), db: Session = Depends(get_db)):
    return BillingUpcomingService(db, current_user, OrgService.get_user_org_id(current_user, db))


@router.get('/upcoming')
def upcoming_billing(billing_upcoming_service: BillingUpcomingService = Depends(get_billing_upcoming_service)):
    return billing_upcoming_service.summary()


def get_billing_usage_service(current_user=Depends(require_admin), db: Session = Depends(get_db)):
    return BillingUsageService(db, current_user, OrgService.get_user_org_id(current_user, db))


def get_owner_billing_usage_service(current_user=Depends(require_owner), db: Session = Depends(get_db)):
    return BillingUsageService(db, current_user, OrgService.get_user_org_id(current_user, db))


class BillingTimezonePayload(BaseModel):
    timezone: str


@router.put("/timezone")
def set_billing_timezone(payload: BillingTimezonePayload, billing_usage_service: BillingUsageService = Depends(get_owner_billing_usage_service)):
    return billing_usage_service.set_timezone(payload.timezone)


@router.get("/usage/current")
def current_billing_usage(billing_usage_service: BillingUsageService = Depends(get_billing_usage_service)):
    return billing_usage_service.current()


@router.get("/usage/periods/{period_id}")
def finalized_billing_usage(period_id: UUID, billing_usage_service: BillingUsageService = Depends(get_billing_usage_service)):
    return billing_usage_service.finalized(period_id)


@router.get("/usage/periods")
def billing_usage_history(before: UUID | None = None, billing_usage_service: BillingUsageService = Depends(get_billing_usage_service)):
    return billing_usage_service.history(before)


@router.get("/usage/periods/{period_id}/settlements")
def billing_usage_settlements(period_id: UUID, billing_usage_service: BillingUsageService = Depends(get_billing_usage_service)):
    return billing_usage_service.settlements(period_id)


def get_billing_adjustment_operator_service(current_user=Depends(require_billing_operator), db: Session = Depends(get_db)):
    return BillingAdjustmentService(db, current_user)


def get_billing_adjustment_admin_service(current_user=Depends(require_admin), db: Session = Depends(get_db)):
    return BillingAdjustmentService(db, current_user, OrgService.get_user_org_id(current_user, db))


class BillingAdjustmentProposal(BaseModel):
    request_id: UUID
    reason: str = Field(min_length=5, max_length=1000)


class BillingAdjustmentDecision(BaseModel):
    decision: Literal["approved", "rejected"]
    reason: str = Field(min_length=5, max_length=1000)


@router.get("/usage/periods/{period_id}/adjustments")
def list_billing_adjustments(period_id: UUID, billing_adjustment_service: BillingAdjustmentService = Depends(get_billing_adjustment_admin_service)):
    return billing_adjustment_service.list(period_id)


@router.get("/operator/organizations/{org_id}/periods/{period_id}/adjustments")
def operator_billing_adjustments(org_id: UUID, period_id: UUID, billing_adjustment_service: BillingAdjustmentService = Depends(get_billing_adjustment_operator_service)):
    return billing_adjustment_service.operator_list(org_id, period_id)


@router.post("/operator/organizations/{org_id}/periods/{period_id}/adjustments")
def propose_billing_adjustment(org_id: UUID, period_id: UUID, payload: BillingAdjustmentProposal,
                               billing_adjustment_service: BillingAdjustmentService = Depends(get_billing_adjustment_operator_service)):
    return billing_adjustment_service.propose(org_id, period_id, payload.request_id, payload.reason)


@router.post("/operator/organizations/{org_id}/periods/{period_id}/adjustments/{adjustment_id}/decision")
def decide_billing_adjustment(org_id: UUID, period_id: UUID, adjustment_id: UUID, payload: BillingAdjustmentDecision,
                              billing_adjustment_service: BillingAdjustmentService = Depends(get_billing_adjustment_operator_service)):
    return billing_adjustment_service.decide(org_id, period_id, adjustment_id, payload.decision, payload.reason)


def get_founding_offer_service(
    current_user=Depends(require_billing_operator),
    db: Session = Depends(get_db),
) -> FoundingOfferService:
    return FoundingOfferService(db, current_user)


@router.get("/operator/founding-offers")
def list_founding_offers(founding_offer_service: FoundingOfferService = Depends(get_founding_offer_service)):
    return founding_offer_service.list_offers()


@router.post("/operator/organizations/{org_id}/founding-offer")
def reserve_founding_offer(org_id: UUID, founding_offer_service: FoundingOfferService = Depends(get_founding_offer_service)):
    return founding_offer_service.reserve(org_id)


@router.post("/operator/organizations/{org_id}/founding-offer/release")
def release_founding_offer(org_id: UUID, founding_offer_service: FoundingOfferService = Depends(get_founding_offer_service)):
    return founding_offer_service.release(org_id)


def get_billing_onboarding_service(
    current_user=Depends(require_owner),
    db: Session = Depends(get_db),
) -> BillingOnboardingService:
    return BillingOnboardingService(db, current_user, OrgService.get_user_org_id(current_user, db))


class BillingConsentPayload(BaseModel):
    interval: Literal["month", "year"]
    consent_version: str
    accepted: Literal[True]


@router.get("/onboarding/options")
def onboarding_options(service: BillingOnboardingService = Depends(get_billing_onboarding_service)):
    return service.options()


@router.post("/onboarding/card-setup")
def onboarding_card_setup(payload: BillingConsentPayload, service: BillingOnboardingService = Depends(get_billing_onboarding_service)):
    return service.setup_card(payload.interval, payload.consent_version)


@router.post("/onboarding/confirm-card")
def onboarding_confirm_card(service: BillingOnboardingService = Depends(get_billing_onboarding_service)):
    return service.confirm_card()


@router.post("/onboarding/embedded-setup")
def embedded_billing_setup(payload: BillingConsentPayload, billing_onboarding_service: BillingOnboardingService = Depends(get_billing_onboarding_service)):
    return billing_onboarding_service.setup_card(payload.interval, payload.consent_version, embedded=True)


@router.post("/onboarding/embedded-confirm")
def embedded_billing_confirm(billing_onboarding_service: BillingOnboardingService = Depends(get_billing_onboarding_service)):
    return billing_onboarding_service.confirm_card(embedded=True)


@router.post("/onboarding/cancel")
def onboarding_cancel(service: BillingOnboardingService = Depends(get_billing_onboarding_service)):
    return service.cancel()


def get_trial_activation_service(
    current_user=Depends(require_billing_operator),
    db: Session = Depends(get_db),
) -> TrialActivationService:
    return TrialActivationService(db, current_user)


@router.post("/operator/organizations/{org_id}/trial-activation", status_code=202)
def request_trial_activation(
    org_id: UUID,
    trial_activation_service: TrialActivationService = Depends(get_trial_activation_service),
):
    return trial_activation_service.request_start(org_id)


def get_billing_service(
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
) -> BillingService:
    return BillingService(db, current_user, org_id=OrgService.get_user_org_id(current_user, db))


def get_owner_billing_service(
    current_user=Depends(require_owner),
    db: Session = Depends(get_db),
) -> BillingService:
    return BillingService(db, current_user, org_id=OrgService.get_user_org_id(current_user, db))


def get_billing_webhook_service(
    db: Session = Depends(get_db),
) -> BillingService:
    # No auth — Stripe signature is verified inside handle_webhook
    return BillingService(db)


@router.post("/subscribe")
async def create_subscription_intent(
    billing_service: BillingService = Depends(get_owner_billing_service),
):
    return await billing_service.create_subscription_intent()


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    billing_service: BillingService = Depends(get_billing_webhook_service),
):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    return await billing_service.handle_webhook(payload, sig_header)


@router.post("/portal")
async def create_portal_session(
    billing_service: BillingService = Depends(get_owner_billing_service),
):
    return await billing_service.create_portal_session()


@router.get("/status")
async def get_billing_status(
    billing_service: BillingService = Depends(get_billing_service),
):
    return await billing_service.get_billing_status()


@router.post("/setup-intent")
async def create_setup_intent(
    billing_profile_service: BillingProfileService = Depends(get_billing_profile_service),
):
    return billing_profile_service.setup()


class SetDefaultCardPayload(BaseModel):
    payment_method_id: str


@router.post("/set-default-card")
async def set_default_card(
    payload: SetDefaultCardPayload,
    billing_profile_service: BillingProfileService = Depends(get_billing_profile_service),
):
    return billing_profile_service.card(payload.payment_method_id)


@router.get("/details")
async def get_billing_details(
    billing_service: BillingService = Depends(get_billing_service),
):
    return await billing_service.get_billing_details()


@router.get("/invoices")
async def billing_invoice_history(before: str | None = None, billing_service: BillingService = Depends(get_billing_service)):
    return await billing_service.invoice_history(before)
