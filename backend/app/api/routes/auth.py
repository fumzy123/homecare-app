from fastapi import APIRouter, Depends
from app.schemas.auth import InviteUserSchema, SignInSchema
from app.services.auth_service import AuthService
from app.core.security import require_admin, security

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


# ─────────────────────────────────────────
# 2. Sign In
# Uses Supabase client → no db needed
# No token yet so no get_current_user
# ─────────────────────────────────────────
@router.post("/sign-in")
async def sign_in(payload: SignInSchema):
    return await AuthService.sign_in(payload)


# ─────────────────────────────────────────
# 3. Sign Out
# Uses Supabase client → no db needed
# Needs token to know who is signing out
# ─────────────────────────────────────────
@router.post("/sign-out")
async def sign_out(token=Depends(security)):
    return await AuthService.sign_out(token.credentials)
