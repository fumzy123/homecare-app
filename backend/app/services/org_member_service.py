from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from supabase_auth.types import User as SupabaseUser
from app.schemas.invitation import AcceptInvitationSchema, INVITE_EXPIRY_SECONDS
from app.schemas.org_member import OrgMemberUpdateSchema, OrgMemberSelfUpdateSchema
from app.models.org_member import OrgMember
from app.core.enums import OrgMemberRole
from app.core.exceptions import AppError
from app.services.org_service import OrgService
from app.repositories.org_member_repository import OrgMemberRepository


class OrgMemberService:

    # ─────────────────────────────────────────
    # 1. Accept invite — create org member
    # ─────────────────────────────────────────
    @staticmethod
    async def create_member(payload: AcceptInvitationSchema, current_user: SupabaseUser, db: Session):
        try:
            repo = OrgMemberRepository(db)
            metadata = current_user.user_metadata or {}
            role = metadata.get("role")
            org_id = metadata.get("org_id")

            if not role or not org_id:
                raise AppError(
                    status_code=400,
                    code="MISSING_METADATA",
                    message="Invite metadata missing role or org_id — invalid invite token",
                )

            if repo.get_by_id(current_user.id):
                raise AppError(
                    status_code=409,
                    code="ALREADY_REGISTERED",
                    message="This invite has already been accepted",
                )

            invitation = repo.get_pending_invitation(current_user.email, org_id)
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

            member = OrgMember(
                id=current_user.id,
                first_name=payload.first_name,
                last_name=payload.last_name,
                email=current_user.email,
                role=role,
                org_id=org_id,
            )
            repo.add(member)
            invitation.accepted_at = datetime.now(timezone.utc)

            db.commit()
            db.refresh(member)
            return member

        except AppError:
            db.rollback()
            raise
        except Exception as e:
            db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 2. List all members in the admin's org
    # ─────────────────────────────────────────
    @staticmethod
    async def get_all_members(current_user: SupabaseUser, db: Session, role: OrgMemberRole | None = None):
        try:
            repo = OrgMemberRepository(db)
            org_id = OrgService.get_admin_org_id(current_user, db)
            return repo.get_all_by_org(org_id, role)

        except AppError:
            raise
        except Exception as e:
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 3. Get a single member
    # ─────────────────────────────────────────
    @staticmethod
    async def get_member(current_user: SupabaseUser, member_id: str, db: Session):
        try:
            repo = OrgMemberRepository(db)
            org_id = OrgService.get_admin_org_id(current_user, db)
            return repo.get_active_member(member_id, org_id)

        except AppError:
            raise
        except Exception as e:
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 4. Admin updates any member in their org
    # ─────────────────────────────────────────
    @staticmethod
    async def update_member(member_id: str, payload: OrgMemberUpdateSchema, current_user: SupabaseUser, db: Session):
        try:
            repo = OrgMemberRepository(db)
            org_id = OrgService.get_admin_org_id(current_user, db)
            member = repo.get_active_member(member_id, org_id)

            updates = payload.model_dump(exclude_unset=True)
            for field, value in updates.items():
                setattr(member, field, value)

            db.commit()
            db.refresh(member)
            return member

        except AppError:
            db.rollback()
            raise
        except Exception as e:
            db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 5. Member updates their own profile
    # ─────────────────────────────────────────
    @staticmethod
    async def update_self(member_id: str, payload: OrgMemberSelfUpdateSchema, current_user: SupabaseUser, db: Session):
        try:
            if str(current_user.id) != member_id:
                raise AppError(status_code=403, code="FORBIDDEN", message="You can only edit your own account")

            repo = OrgMemberRepository(db)
            member = repo.get_by_id_no_org_filter(member_id)
            if not member:
                raise AppError(status_code=404, code="NOT_FOUND", message="Member not found")

            updates = payload.model_dump(exclude_unset=True)
            for field, value in updates.items():
                setattr(member, field, value)

            # Sync name/email to Supabase Auth so JWT stays fresh
            from app.db.supabase import get_supabase_client
            supabase = get_supabase_client()
            auth_update: dict = {}
            if payload.email is not None and payload.email != current_user.email:
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

            db.commit()
            db.refresh(member)
            return member

        except AppError:
            db.rollback()
            raise
        except Exception as e:
            db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 6. Soft delete a member (admin only)
    # ─────────────────────────────────────────
    @staticmethod
    async def delete_member(member_id: str, current_user: SupabaseUser, db: Session):
        try:
            repo = OrgMemberRepository(db)
            org_id = OrgService.get_admin_org_id(current_user, db)
            member = repo.get_active_member(member_id, org_id)

            member.deleted_at = datetime.now(timezone.utc)
            db.commit()
            return {"message": "Member deleted successfully"}

        except AppError:
            db.rollback()
            raise
        except Exception as e:
            db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))
