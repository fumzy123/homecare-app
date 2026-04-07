from fastapi import APIRouter, Depends, Query
from app.services.org_member_service import OrgMemberService
from app.core.security import require_admin
from app.core.enums import OrgMemberRole

router = APIRouter()


# ─────────────────────────────────────────
# 1. List all members in the admin's org
# Optional filter: ?role=home_support_worker
# ─────────────────────────────────────────
@router.get("/")
async def get_all_members(
    role: OrgMemberRole | None = Query(default=None, description="Filter by role"),
    current_user=Depends(require_admin)
):
    return await OrgMemberService.get_all_members(current_user, role)


# ─────────────────────────────────────────
# 2. Get a single member's full profile
# Enforces tenant isolation (same org only)
# ─────────────────────────────────────────
@router.get("/{member_id}")
async def get_member(
    member_id: str,
    current_user=Depends(require_admin)
):
    return await OrgMemberService.get_member(current_user, member_id)
