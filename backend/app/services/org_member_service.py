from sqlalchemy.orm import Session
from supabase_auth.types import User as SupabaseUser
from app.models.org_member import OrgMember
from app.models.worker_profile import WorkerProfile
from app.schemas.invitation import AcceptInvitationSchema
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
                raise AppError(status_code=404, code="NOT_FOUND", message="Member not found")

            return member

        except AppError:
            raise
        except Exception as e:
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))
