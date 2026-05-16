from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import require_admin
from app.services.billing_service import BillingService

router = APIRouter()


# ─────────────────────────────────────────
# 1. Create checkout session
# ─────────────────────────────────────────
@router.post("/checkout")
async def create_checkout_session(
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return await BillingService.create_checkout_session(current_user, db)


# ─────────────────────────────────────────
# 2. Stripe webhook
# Called by Stripe directly — no JWT auth, verified by signature instead
# ─────────────────────────────────────────
@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    return await BillingService.handle_webhook(payload, sig_header, db)


# ─────────────────────────────────────────
# 3. Customer portal — manage subscription, cancel, update card
# ─────────────────────────────────────────
@router.post("/portal")
async def create_portal_session(
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return await BillingService.create_portal_session(current_user, db)


# ─────────────────────────────────────────
# 4. Billing status
# ─────────────────────────────────────────
@router.get("/status")
async def get_billing_status(
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return await BillingService.get_billing_status(current_user, db)
