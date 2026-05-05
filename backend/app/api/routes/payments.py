from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import require_admin
from app.services.payment_service import PaymentService

router = APIRouter()


# ─────────────────────────────────────────
# 1. Create checkout session
# Frontend calls this, then redirects to the returned URL
# ─────────────────────────────────────────
@router.post("/checkout")
async def create_checkout_session(
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return await PaymentService.create_checkout_session(current_user, db)


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
    return await PaymentService.handle_webhook(payload, sig_header, db)


# ─────────────────────────────────────────
# 3. Payment status
# Frontend uses this to check if the org has paid
# ─────────────────────────────────────────
@router.get("/status")
async def get_payment_status(
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return await PaymentService.get_payment_status(current_user, db)
