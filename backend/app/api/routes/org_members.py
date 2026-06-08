from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.schemas.invitation import AcceptInvitationSchema
from app.schemas.org_member import OrgMemberResponse, OrgMemberUpdateSchema, OrgMemberSelfUpdateSchema
from app.services.org_member_service import OrgMemberService, _flat_response
from app.services.org_service import OrgService
from app.repositories.organization_repository import OrganizationRepository
from app.core.security import require_admin, get_current_user
from app.core.exceptions import AppError
from app.core.enums import OrgMemberRole

router = APIRouter(prefix="/org-members", tags=["Org Members"])


def get_org_member_admin_service(
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
) -> OrgMemberService:
    return OrgMemberService(db, current_user, org_id=OrgService.get_user_org_id(current_user, db))


def get_org_org_member_service(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OrgMemberService:
    return OrgMemberService(db, current_user)


# ─────────────────────────────────────────
# 1. Accept an invite — create org member
# ─────────────────────────────────────────
@router.post("", response_model=OrgMemberResponse)
async def create_member(
    payload: AcceptInvitationSchema,
    org_member_service: OrgMemberService = Depends(get_org_org_member_service),
):
    return await org_member_service.create_member(payload)


# ─────────────────────────────────────────
# 2. Get current user's own profile (/me must be before /{member_id})
# ─────────────────────────────────────────
@router.get("/me", response_model=OrgMemberResponse)
async def get_me(
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    employment = OrganizationRepository(db).get_active_employment_for_user(current_user.id)
    if not employment:
        raise AppError(status_code=404, code="NOT_FOUND", message="Member record not found")
    return _flat_response(employment)


# ─────────────────────────────────────────
# 3. List all members — optional ?role= filter
# ─────────────────────────────────────────
@router.get("", response_model=List[OrgMemberResponse])
async def get_all_members(
    role: OrgMemberRole | None = Query(default=None, description="Filter by role"),
    org_member_service: OrgMemberService = Depends(get_org_member_admin_service),
):
    return await org_member_service.get_all_members(role)


# ─────────────────────────────────────────
# 3. Get a single member
# ─────────────────────────────────────────
@router.get("/{member_id}", response_model=OrgMemberResponse)
async def get_member(
    member_id: str,
    org_member_service: OrgMemberService = Depends(get_org_member_admin_service),
):
    return await org_member_service.get_member(member_id)


# ─────────────────────────────────────────
# 4. Admin updates any member in their org
# ─────────────────────────────────────────
@router.patch("/{member_id}", response_model=OrgMemberResponse)
async def update_member(
    member_id: str,
    payload: OrgMemberUpdateSchema,
    org_member_service: OrgMemberService = Depends(get_org_member_admin_service),
):
    return await org_member_service.update_member(member_id, payload)


# ─────────────────────────────────────────
# 5. Member updates their own profile
# ─────────────────────────────────────────
@router.patch("/{member_id}/self", response_model=OrgMemberResponse)
async def update_self(
    member_id: str,
    payload: OrgMemberSelfUpdateSchema,
    org_member_service: OrgMemberService = Depends(get_org_org_member_service),
):
    return await org_member_service.update_self(member_id, payload)


# ─────────────────────────────────────────
# 6. Soft delete a member (admin only)
# ─────────────────────────────────────────
@router.delete("/{member_id}", status_code=204)
async def delete_member(
    member_id: str,
    org_member_service: OrgMemberService = Depends(get_org_member_admin_service),
):
    return await org_member_service.delete_member(member_id)
