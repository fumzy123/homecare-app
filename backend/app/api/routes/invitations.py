from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.invitation import CreateInvitationSchema
from app.services.invitation_service import InvitationService
from app.core.security import require_admin
from app.core.limiter import limiter

router = APIRouter(prefix="/invitations", tags=["Invitations"])


def get_invitation_service(
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
) -> InvitationService:
    return InvitationService(db, current_user)


# ─────────────────────────────────────────
# 1. Send an invitation
# Writes to invitations table + sends email
# Only owners and admins can do this
# ─────────────────────────────────────────
@router.post("")
@limiter.limit("20/hour")
async def create_invitation(
    request: Request,
    payload: CreateInvitationSchema,
    invitation_service: InvitationService = Depends(get_invitation_service),
):
    return await invitation_service.create_invitation(payload)


# ─────────────────────────────────────────
# 2. List all invitations for the org
# Returns pending and accepted
# ─────────────────────────────────────────
@router.get("")
async def list_invitations(
    invitation_service: InvitationService = Depends(get_invitation_service),
):
    return await invitation_service.list_invitations()


# ─────────────────────────────────────────
# 3. Resend an invitation
# Refreshes invited_at and resends the email
# ─────────────────────────────────────────
@router.post("/{invitation_id}/resend")
@limiter.limit("20/hour")
async def resend_invitation(
    request: Request,  # noqa: ARG001 — required by slowapi rate limiter
    invitation_id: str,
    invitation_service: InvitationService = Depends(get_invitation_service),
):
    return await invitation_service.resend_invitation(invitation_id)


# ─────────────────────────────────────────
# 4. Revoke an invitation
# ─────────────────────────────────────────
@router.delete("/{invitation_id}")
async def revoke_invitation(
    invitation_id: str,
    invitation_service: InvitationService = Depends(get_invitation_service),
):
    return await invitation_service.revoke_invitation(invitation_id)
