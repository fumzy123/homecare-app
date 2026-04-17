from datetime import datetime, timezone
from sqlalchemy.orm import Session
from supabase_auth.types import User as SupabaseUser
from app.models.org_member import OrgMember
from app.models.worker_profile import WorkerProfile
from app.models.invitation import Invitation
from app.schemas.invitation import AcceptInvitationSchema
from app.schemas.account import AccountUpdateSchema
from app.core.enums import OrgMemberRole
from app.core.exceptions import AppError
from app.services.org_service import OrgService


class OrgMemberService:

    # ─────────────────────────────────────────
    # 1. Create org member on invite acceptance
    # Called by the invited user after they accept
    # the email invite and set their password.
    # role + org_id are read from their JWT metadata.
    # ─────────────────────────────────────────
    @staticmethod
    async def create_member(payload: AcceptInvitationSchema, current_user: SupabaseUser, db: Session):
        try:
            metadata = current_user.user_metadata or {}
            role = metadata.get("role")
            org_id = metadata.get("org_id")

            if not role or not org_id:
                raise AppError(
                    status_code=400,
                    code="MISSING_METADATA",
                    message="Invite metadata missing role or org_id — invalid invite token",
                )

            # Guard against duplicate acceptance
            existing = db.query(OrgMember).filter(OrgMember.id == current_user.id).first()
            if existing:
                raise AppError(
                    status_code=409,
                    code="ALREADY_REGISTERED",
                    message="This invite has already been accepted",
                )

            # Find the matching invitation and check it hasn't expired
            invitation = db.query(Invitation).filter(
                Invitation.email == current_user.email,
                Invitation.org_id == org_id,
                Invitation.accepted_at == None,  # noqa: E711
            ).first()

            if not invitation:
                raise AppError(
                    status_code=404,
                    code="INVITATION_NOT_FOUND",
                    message="No pending invitation found for this email",
                )

            if datetime.now(timezone.utc) > invitation.expires_at.replace(tzinfo=timezone.utc):
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
            db.add(member)

            # Create an empty worker profile if the role is a home support worker
            if role == OrgMemberRole.home_support_worker:
                db.add(WorkerProfile(org_member_id=current_user.id))

            # Mark invitation as accepted
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

        except AppError:
            raise
        except Exception as e:
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 3. Update own account (self-edit only)
    # ─────────────────────────────────────────
    @staticmethod
    async def update_self(member_id: str, payload: AccountUpdateSchema, current_user: SupabaseUser, db: Session):
        try:
            if str(current_user.id) != member_id:
                raise AppError(status_code=403, code="FORBIDDEN", message="You can only edit your own account")

            member = db.query(OrgMember).filter(
                OrgMember.id == member_id,
                OrgMember.deleted_at == None,  # noqa: E711
            ).first()

            if not member:
                raise AppError(status_code=404, code="NOT_FOUND", message="Member not found")

            if payload.first_name is not None:
                member.first_name = payload.first_name
            if payload.last_name is not None:
                member.last_name = payload.last_name
            if payload.email is not None and payload.email != member.email:
                member.email = payload.email

            # Keep Supabase Auth metadata in sync so the JWT always
            # reflects the latest name and email after token refresh
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
    # 4. Get a single member
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
                raise AppError(status_code=404, code="NOT_FOUND", message="Member not found")

            return member

        except AppError:
            raise
        except Exception as e:
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))
