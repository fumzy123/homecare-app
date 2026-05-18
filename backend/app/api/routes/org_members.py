from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.schemas.invitation import AcceptInvitationSchema
from app.schemas.org_member import OrgMemberResponse, OrgMemberUpdateSchema, OrgMemberSelfUpdateSchema
from app.services.org_member_service import OrgMemberService
from app.core.security import require_admin, get_current_user
from app.core.enums import OrgMemberRole

router = APIRouter(prefix="/org-members", tags=["Org Members"])


# ─────────────────────────────────────────
# 1. Accept an invite — create org member
# ─────────────────────────────────────────
@router.post("", response_model=OrgMemberResponse)
async def create_member(
    payload: AcceptInvitationSchema,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return await OrgMemberService.create_member(payload, current_user, db)


# ─────────────────────────────────────────
# 2. List all members — optional ?role= filter
# ─────────────────────────────────────────
@router.get("", response_model=List[OrgMemberResponse])
async def get_all_members(
    role: OrgMemberRole | None = Query(default=None, description="Filter by role"),
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return await OrgMemberService.get_all_members(current_user, db, role)


# ─────────────────────────────────────────
# 3. Get a single member
# ─────────────────────────────────────────
@router.get("/{member_id}", response_model=OrgMemberResponse)
async def get_member(
    member_id: str,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return await OrgMemberService.get_member(current_user, member_id, db)


# ─────────────────────────────────────────
# 4. Admin updates any member in their org
# ─────────────────────────────────────────
@router.patch("/{member_id}", response_model=OrgMemberResponse)
async def update_member(
    member_id: str,
    payload: OrgMemberUpdateSchema,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return await OrgMemberService.update_member(member_id, payload, current_user, db)


# ─────────────────────────────────────────
# 5. Member updates their own profile
# ─────────────────────────────────────────
@router.patch("/{member_id}/self", response_model=OrgMemberResponse)
async def update_self(
    member_id: str,
    payload: OrgMemberSelfUpdateSchema,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return await OrgMemberService.update_self(member_id, payload, current_user, db)


# ─────────────────────────────────────────
# 6. Soft delete a member (admin only)
# ─────────────────────────────────────────
@router.delete("/{member_id}", status_code=204)
async def delete_member(
    member_id: str,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return await OrgMemberService.delete_member(member_id, current_user, db)
