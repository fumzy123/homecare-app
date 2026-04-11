from fastapi import APIRouter, Depends
from app.schemas.invitation import CreateInvitationSchema
from app.services.invitation_service import InvitationService
from app.core.security import require_admin

router = APIRouter()


# ─────────────────────────────────────────
# 1. Invite someone to join the Organization
# Uses Supabase client → no db needed
# Only owners and admins can do this
# ─────────────────────────────────────────
@router.post("/")
async def create_invitation(
    payload: CreateInvitationSchema,
    current_user=Depends(require_admin),
):
    return await InvitationService.create_invitation(payload, current_user)
