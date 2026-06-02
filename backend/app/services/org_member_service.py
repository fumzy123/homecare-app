from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from supabase_auth.types import User as SupabaseUser
from app.schemas.invitation import AcceptInvitationSchema, INVITE_EXPIRY_SECONDS
from app.schemas.org_member import OrgMemberUpdateSchema, OrgMemberSelfUpdateSchema
from app.models.org_member import OrgMember
from app.core.enums import OrgMemberRole, EmploymentType
from app.core.exceptions import AppError
from app.repositories.org_member_repository import OrgMemberRepository

_DEFAULT_HOURS: dict[EmploymentType, int] = {
    EmploymentType.full_time: 40,
    EmploymentType.part_time: 24,
    # casual has no default cap
}


class OrgMemberService:

    def __init__(self, db: Session, current_user: SupabaseUser, org_id=None):
        self.db = db
        self.current_user = current_user
        self.org_member_repo = OrgMemberRepository(db)
        # org_id is None for create_member (user not in members table yet)
        # and update_self (no org scoping needed). Admin factory passes it in.
        self.org_id = org_id

    # ─────────────────────────────────────────
    # 1. Accept invite — create org member
    # org_id comes from the invite JWT metadata,
    # not from the DB (user has no member record yet)
    # ─────────────────────────────────────────
    async def create_member(self, payload: AcceptInvitationSchema):
        try:
            metadata = self.current_user.user_metadata or {}
            role = metadata.get("role")
            org_id = metadata.get("org_id")

            if not role or not org_id:
                raise AppError(
                    status_code=400,
                    code="MISSING_METADATA",
                    message="Invite metadata missing role or org_id — invalid invite token",
                )

            if self.org_member_repo.get_by_id(self.current_user.id):
                raise AppError(
                    status_code=409,
                    code="ALREADY_REGISTERED",
                    message="This invite has already been accepted",
                )

            invitation = self.org_member_repo.get_pending_invitation(self.current_user.email, org_id)
            if not invitation:
                raise AppError(
                    status_code=404,
                    code="INVITATION_NOT_FOUND",
                    message="No pending invitation found for this email",
                )

            if datetime.now(timezone.utc) > invitation.invited_at + timedelta(seconds=INVITE_EXPIRY_SECONDS):
                raise AppError(
                    status_code=410,
                    code="INVITATION_EXPIRED",
                    message="This invitation has expired — ask an admin to send a new one",
                )

            employment_type_str = metadata.get("employment_type")
            employment_type = EmploymentType(employment_type_str) if employment_type_str else None
            max_hours = _DEFAULT_HOURS.get(employment_type) if employment_type else None

            member = OrgMember(
                id=self.current_user.id,
                first_name=payload.first_name,
                last_name=payload.last_name,
                email=self.current_user.email,
                role=role,
                org_id=org_id,
                employment_type=employment_type,
                max_hours_per_week=max_hours,
            )
            self.org_member_repo.add(member)
            invitation.accepted_at = datetime.now(timezone.utc)

            self.db.commit()
            self.db.refresh(member)
            return member

        except AppError:
            self.db.rollback()
            raise
        except Exception as e:
            self.db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 2. List all members — optional ?role= filter
    # ─────────────────────────────────────────
    async def get_all_members(self, role: OrgMemberRole | None = None):
        try:
            return self.org_member_repo.get_all_by_org(self.org_id, role)

        except AppError:
            raise
        except Exception as e:
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 3. Get a single member
    # ─────────────────────────────────────────
    async def get_member(self, member_id: str):
        try:
            return self.org_member_repo.get_active_member(member_id, self.org_id)

        except AppError:
            raise
        except Exception as e:
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 4. Admin updates any member in their org
    # ─────────────────────────────────────────
    async def update_member(self, member_id: str, payload: OrgMemberUpdateSchema):
        try:
            member = self.org_member_repo.get_active_member(member_id, self.org_id)

            updates = payload.model_dump(exclude_unset=True)
            for field, value in updates.items():
                setattr(member, field, value)

            self.db.commit()
            self.db.refresh(member)
            return member

        except AppError:
            self.db.rollback()
            raise
        except Exception as e:
            self.db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 5. Member updates their own profile
    # ─────────────────────────────────────────
    async def update_self(self, member_id: str, payload: OrgMemberSelfUpdateSchema):
        try:
            if str(self.current_user.id) != member_id:
                raise AppError(status_code=403, code="FORBIDDEN", message="You can only edit your own account")

            member = self.org_member_repo.get_by_id_no_org_filter(member_id)
            if not member:
                raise AppError(status_code=404, code="NOT_FOUND", message="Member not found")

            updates = payload.model_dump(exclude_unset=True)
            for field, value in updates.items():
                setattr(member, field, value)

            from app.db.supabase import get_supabase_client
            supabase = get_supabase_client()
            auth_update: dict = {}
            if payload.email is not None and payload.email != self.current_user.email:
                auth_update["email"] = payload.email
            metadata_update = {}
            if payload.first_name is not None:
                metadata_update["first_name"] = payload.first_name
            if payload.last_name is not None:
                metadata_update["last_name"] = payload.last_name
            if metadata_update:
                auth_update["user_metadata"] = metadata_update
            if auth_update:
                supabase.auth.admin.update_user_by_id(member_id, auth_update)

            self.db.commit()
            self.db.refresh(member)
            return member

        except AppError:
            self.db.rollback()
            raise
        except Exception as e:
            self.db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 6. Soft delete a member (admin only)
    # ─────────────────────────────────────────
    async def delete_member(self, member_id: str):
        try:
            member = self.org_member_repo.get_active_member(member_id, self.org_id)

            member.deleted_at = datetime.now(timezone.utc)
            self.db.commit()
            return {"message": "Member deleted successfully"}

        except AppError:
            self.db.rollback()
            raise
        except Exception as e:
            self.db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))
