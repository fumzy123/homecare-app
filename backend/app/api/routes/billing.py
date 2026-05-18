from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import require_admin
from app.services.billing_service import BillingService

router = APIRouter()


@router.post("/subscribe")
async def create_subscription_intent(
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return await BillingService.create_subscription_intent(current_user, db)


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    return await BillingService.handle_webhook(payload, sig_header, db)


@router.post("/portal")
async def create_portal_session(
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return await BillingService.create_portal_session(current_user, db)


@router.get("/status")
async def get_billing_status(
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return await BillingService.get_billing_status(current_user, db)


@router.post("/setup-intent")
async def create_setup_intent(
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return await BillingService.create_setup_intent(current_user, db)


class SetDefaultCardPayload(BaseModel):
    payment_method_id: str


@router.post("/set-default-card")
async def set_default_card(
    payload: SetDefaultCardPayload,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return await BillingService.set_default_payment_method(current_user, payload.payment_method_id, db)


@router.get("/details")
async def get_billing_details(
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return await BillingService.get_billing_details(current_user, db)
