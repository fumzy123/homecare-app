from fastapi import APIRouter, Depends, Request
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

router = APIRouter(prefix="/billing", tags=["Billing"])


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
    billing_service: BillingService = Depends(get_owner_billing_service),
):
    return await billing_service.create_setup_intent()


class SetDefaultCardPayload(BaseModel):
    payment_method_id: str


@router.post("/set-default-card")
async def set_default_card(
    payload: SetDefaultCardPayload,
    billing_service: BillingService = Depends(get_owner_billing_service),
):
    return await billing_service.set_default_payment_method(payload.payment_method_id)


@router.get("/details")
async def get_billing_details(
    billing_service: BillingService = Depends(get_billing_service),
):
    return await billing_service.get_billing_details()


@router.get("/invoices")
async def billing_invoice_history(before: str | None = None, billing_service: BillingService = Depends(get_billing_service)):
    return await billing_service.invoice_history(before)
