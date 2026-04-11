from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.invitation import CreateInvitationSchema
from app.services.invitation_service import InvitationService
from app.core.security import require_admin

router = APIRouter()


# ─────────────────────────────────────────
# 1. Send an invitation
# Writes to invitations table + sends email
# Only owners and admins can do this
# ─────────────────────────────────────────
@router.post("/")
async def create_invitation(
    payload: CreateInvitationSchema,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return await InvitationService.create_invitation(payload, current_user, db)


# ─────────────────────────────────────────
# 2. List all invitations for the org
# Returns pending and accepted
# ─────────────────────────────────────────
@router.get("/")
async def list_invitations(
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return await InvitationService.list_invitations(current_user, db)


# ─────────────────────────────────────────
# 3. Revoke an invitation
# ─────────────────────────────────────────
@router.delete("/{invitation_id}")
async def revoke_invitation(
    invitation_id: str,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return await InvitationService.revoke_invitation(invitation_id, current_user, db)
