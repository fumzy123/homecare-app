from fastapi import HTTPException
from sqlalchemy.orm import Session
from supabase_auth.types import User as SupabaseUser
from app.models.org_member import OrgMember
from app.core.enums import OrgMemberRole
from app.services.org_service import OrgService


class OrgMemberService:

    # ─────────────────────────────────────────
    # 1. List all members in the admin's org
    # Optional filter: ?role=home_support_worker
    # ─────────────────────────────────────────
    @staticmethod
    async def get_all_members(current_user: SupabaseUser, db: Session, role: OrgMemberRole | None = None):
        try:
            org_id = OrgService.get_admin_org_id(current_user, db)

            query = db.query(OrgMember).filter(
                OrgMember.org_id == org_id,
                OrgMember.deleted_at == None,  # noqa: E711
            )

            if role is not None:
                query = query.filter(OrgMember.role == role)

            return query.all()

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

    # ─────────────────────────────────────────
    # 2. Get a single member
    # Enforces tenant isolation (same org only)
    # ─────────────────────────────────────────
    @staticmethod
    async def get_member(current_user: SupabaseUser, member_id: str, db: Session):
        try:
            org_id = OrgService.get_admin_org_id(current_user, db)

            member = db.query(OrgMember).filter(
                OrgMember.id == member_id,
                OrgMember.org_id == org_id,
                OrgMember.deleted_at == None,  # noqa: E711
            ).first()

            if not member:
                raise HTTPException(status_code=404, detail="Member not found")

            return member

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
