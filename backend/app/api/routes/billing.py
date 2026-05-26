from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import require_admin
from app.services.billing_service import BillingService
from app.services.org_service import OrgService

router = APIRouter(prefix="/billing", tags=["Billing"])


def get_billing_service(
    current_user=Depends(require_admin),
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
    billing_service: BillingService = Depends(get_billing_service),
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
    billing_service: BillingService = Depends(get_billing_service),
):
    return await billing_service.create_portal_session()


@router.get("/status")
async def get_billing_status(
    billing_service: BillingService = Depends(get_billing_service),
):
    return await billing_service.get_billing_status()


@router.post("/setup-intent")
async def create_setup_intent(
    billing_service: BillingService = Depends(get_billing_service),
):
    return await billing_service.create_setup_intent()


class SetDefaultCardPayload(BaseModel):
    payment_method_id: str


@router.post("/set-default-card")
async def set_default_card(
    payload: SetDefaultCardPayload,
    billing_service: BillingService = Depends(get_billing_service),
):
    return await billing_service.set_default_payment_method(payload.payment_method_id)


@router.get("/details")
async def get_billing_details(
    billing_service: BillingService = Depends(get_billing_service),
):
    return await billing_service.get_billing_details()
