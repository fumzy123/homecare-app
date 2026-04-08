from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.schemas.organization import RegisterOrganizationSchema, OrganizationUpdateSchema, OrganizationResponseSchema
from app.services.org_service import OrgService
from app.core.security import require_admin, require_owner
from app.db.session import get_db

router = APIRouter()


# ─────────────────────────────────────────
# 1. Register a new organization + owner
# Public — no auth required
# ─────────────────────────────────────────
@router.post("/", response_model=None)
async def register_organization(payload: RegisterOrganizationSchema):
    return await OrgService.register_organization(payload)


# ─────────────────────────────────────────
# 2. Get current user's organization
# Any admin in the org can view it
# ─────────────────────────────────────────
@router.get("/", response_model=OrganizationResponseSchema)
async def get_organization(
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return await OrgService.get_organization(current_user, db)


# ─────────────────────────────────────────
# 3. Update organization (owner only)
# ─────────────────────────────────────────
@router.patch("/", response_model=OrganizationResponseSchema)
async def update_organization(
    payload: OrganizationUpdateSchema,
    current_user=Depends(require_owner),
    db: Session = Depends(get_db),
):
    return await OrgService.update_organization(payload, current_user, db)


# ─────────────────────────────────────────
# 4. Deactivate organization (owner only)
# Sets is_active = False — not a hard delete
# ─────────────────────────────────────────
@router.delete("/")
async def delete_organization(
    current_user=Depends(require_owner),
    db: Session = Depends(get_db),
):
    return await OrgService.delete_organization(current_user, db)
