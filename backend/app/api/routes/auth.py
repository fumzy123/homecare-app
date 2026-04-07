from fastapi import APIRouter, Depends
from app.schemas.auth import (
    RegisterOrganizationSchema,
    InviteUserSchema,
    SignInSchema,
)
from app.services.auth_service import AuthService
from app.core.security import get_current_user, require_admin, security

router = APIRouter()

# ─────────────────────────────────────────
# 1. Register a Home Care Agency Organization
# Uses Supabase client → no db needed
# ─────────────────────────────────────────
@router.post("/register-organization")
async def register_organization(payload: RegisterOrganizationSchema):
    return await AuthService.register_organization(payload)


# ─────────────────────────────────────────
# 2. Invite someone to join the Organization
# Uses Supabase client → no db needed
# Only owners and admins can do this
# ─────────────────────────────────────────
@router.post("/invite")
async def invite_user(
    payload: InviteUserSchema,
    current_user=Depends(require_admin)
):
    return await AuthService.invite_user(payload, current_user)


# ─────────────────────────────────────────
# 3. Sign In
# Uses Supabase client → no db needed
# No token yet so no get_current_user
# ─────────────────────────────────────────
@router.post("/sign-in")
async def sign_in(payload: SignInSchema):
    return await AuthService.sign_in(payload)


# ─────────────────────────────────────────
# 4. Sign Out
# Uses Supabase client → no db needed
# Needs token to know who is signing out
# ─────────────────────────────────────────
@router.post("/sign-out")
async def sign_out(token=Depends(security)):
    return await AuthService.sign_out(token.credentials)