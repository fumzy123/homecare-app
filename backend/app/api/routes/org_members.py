from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.auth import AcceptInviteSchema
from app.services.org_member_service import OrgMemberService
from app.core.security import require_admin, get_current_user
from app.core.enums import OrgMemberRole

router = APIRouter()


# ─────────────────────────────────────────
# 1. Accept an invite — create org member
# Called by the invited user after they click
# the invite link and set their password.
# ─────────────────────────────────────────
@router.post("/")
async def create_member(
    payload: AcceptInviteSchema,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return await OrgMemberService.create_member(payload, current_user, db)


# ─────────────────────────────────────────
# 2. List all members in the admin's org
# Optional filter: ?role=home_support_worker
# ─────────────────────────────────────────
@router.get("/")
async def get_all_members(
    role: OrgMemberRole | None = Query(default=None, description="Filter by role"),
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return await OrgMemberService.get_all_members(current_user, db, role)


# ─────────────────────────────────────────
# 2. Get a single member's full profile
# Enforces tenant isolation (same org only)
# ─────────────────────────────────────────
@router.get("/{member_id}")
async def get_member(
    member_id: str,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return await OrgMemberService.get_member(current_user, member_id, db)
