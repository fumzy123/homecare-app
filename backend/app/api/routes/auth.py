from fastapi import APIRouter, Depends
from app.schemas.auth import InviteUserSchema
from app.services.auth_service import AuthService
from app.core.security import require_admin

router = APIRouter()


# ─────────────────────────────────────────
# 1. Invite someone to join the Organization
# Uses Supabase client → no db needed
# Only owners and admins can do this
# ─────────────────────────────────────────
@router.post("/invite")
async def invite_user(
    payload: InviteUserSchema,
    current_user=Depends(require_admin),
):
    return await AuthService.invite_user(payload, current_user)
