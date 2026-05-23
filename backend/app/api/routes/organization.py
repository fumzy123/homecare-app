from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from slowapi.util import get_remote_address
from app.schemas.organization import RegisterOrganizationSchema, OrganizationUpdateSchema, OrganizationResponseSchema, RegisterDirectSchema
from app.services.org_service import OrgService
from app.core.security import require_admin, require_owner, get_current_user
from app.core.limiter import limiter
from app.db.session import get_db

router = APIRouter(prefix="/organization", tags=["Organization"])


def get_org_user_service(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OrgService:
    # User is authenticated but not yet an org member — no org_id to resolve
    return OrgService(db, current_user)


def get_org_public_service(
    db: Session = Depends(get_db),
) -> OrgService:
    # No auth — demo/direct registration bypass
    return OrgService(db)


def get_org_admin_service(
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
) -> OrgService:
    return OrgService(db, current_user, org_id=OrgService.get_admin_org_id(current_user, db))


def get_org_owner_service(
    current_user=Depends(require_owner),
    db: Session = Depends(get_db),
) -> OrgService:
    return OrgService(db, current_user, org_id=OrgService.get_admin_org_id(current_user, db))


# ─────────────────────────────────────────
# 1. Register a new organization + owner
# Authenticated — frontend creates the Supabase user first,
# then calls this endpoint with the JWT to set up the org
# ─────────────────────────────────────────
@router.post("", response_model=None)
@limiter.limit("5/minute", key_func=get_remote_address)
async def register_organization(
    request: Request,
    payload: RegisterOrganizationSchema,
    org_service: OrgService = Depends(get_org_user_service),
):
    return await org_service.register_organization(payload)


# ─────────────────────────────────────────
# 1b. Register without email confirmation (demo / dev bypass)
# ─────────────────────────────────────────
@router.post("/register-direct", response_model=None)
@limiter.limit("5/minute", key_func=get_remote_address)
async def register_organization_direct(
    request: Request,
    payload: RegisterDirectSchema,
    org_service: OrgService = Depends(get_org_public_service),
):
    return await org_service.register_organization_direct(payload)


# ─────────────────────────────────────────
# 2. Get current user's organization
# Any admin in the org can view it
# ─────────────────────────────────────────
@router.get("", response_model=OrganizationResponseSchema)
async def get_organization(
    org_service: OrgService = Depends(get_org_admin_service),
):
    return await org_service.get_organization()


# ─────────────────────────────────────────
# 3. Update organization (owner only)
# ─────────────────────────────────────────
@router.patch("", response_model=OrganizationResponseSchema)
async def update_organization(
    payload: OrganizationUpdateSchema,
    org_service: OrgService = Depends(get_org_owner_service),
):
    return await org_service.update_organization(payload)


# ─────────────────────────────────────────
# 4. Deactivate organization (owner only)
# Sets is_active = False — not a hard delete
# ─────────────────────────────────────────
@router.delete("")
async def delete_organization(
    org_service: OrgService = Depends(get_org_owner_service),
):
    return await org_service.delete_organization()
