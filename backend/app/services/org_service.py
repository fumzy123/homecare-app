from sqlalchemy.orm import Session
from supabase_auth.types import User as SupabaseUser
from app.models.org_member import OrgMember
from app.models.organization import Organization
from app.schemas.organization import RegisterOrganizationSchema, OrganizationUpdateSchema
from app.core.enums import OrgMemberRole
from app.core.exceptions import AppError
from app.db.supabase import get_supabase_client
import uuid


class OrgService:

    @staticmethod
    def get_admin_org_id(current_user: SupabaseUser, db: Session) -> uuid.UUID:
        """Resolve the org_id for the currently authenticated user. Used by all services."""
        member = db.query(OrgMember).filter(OrgMember.id == current_user.id).first()
        if not member:
            raise AppError(status_code=404, code="NOT_FOUND", message="Member record not found")
        return member.org_id

    # ─────────────────────────────────────────
    # 1. Register a new organization + owner
    # Called from POST /api/organization (public)
    # Uses Supabase client — no db needed
    # ─────────────────────────────────────────
    @staticmethod
    async def register_organization(payload: RegisterOrganizationSchema, current_user: SupabaseUser, db: Session):
        supabase = get_supabase_client()
        org_id = None
        try:
            # 1. Create the organization record
            new_org = Organization(
                id=uuid.uuid4(),
                name=payload.organization_name,
                owner_id=current_user.id,
            )
            db.add(new_org)
            db.flush()  # get the org id without committing yet
            org_id = new_org.id

            # 2. Link the owner as an org_member
            new_member = OrgMember(
                id=current_user.id,
                first_name=payload.first_name,
                last_name=payload.last_name,
                email=current_user.email,
                role=OrgMemberRole.owner,
                org_id=org_id,
            )
            db.add(new_member)
            db.commit()

            # Bake role + org_id into the owner's JWT metadata
            # so require_admin can read it from user_metadata on every request
            supabase.auth.admin.update_user_by_id(
                str(current_user.id),
                {"user_metadata": {"role": OrgMemberRole.owner, "org_id": str(org_id)}}
            )

            return {
                "message": "Organization registered successfully",
                "org_id": str(org_id),
                "user_id": str(current_user.id),
            }

        except AppError:
            db.rollback()
            raise
        except Exception as e:
            db.rollback()
            # Compensating transaction — delete the Supabase user if DB setup failed
            # so we don't leave an orphaned auth user with no org
            if org_id is None:
                try:
                    supabase.auth.admin.delete_user(str(current_user.id))
                except Exception:
                    pass
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 2. Get the current user's organization
    # ─────────────────────────────────────────
    @staticmethod
    async def get_organization(current_user: SupabaseUser, db: Session):
        try:
            org_id = OrgService.get_admin_org_id(current_user, db)
            org = db.query(Organization).filter(Organization.id == org_id).first()
            if not org:
                raise AppError(status_code=404, code="NOT_FOUND", message="Organization not found")
            return org

        except AppError:
            raise
        except Exception as e:
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 3. Update organization (owner only)
    # ─────────────────────────────────────────
    @staticmethod
    async def update_organization(payload: OrganizationUpdateSchema, current_user: SupabaseUser, db: Session):
        try:
            org_id = OrgService.get_admin_org_id(current_user, db)
            org = db.query(Organization).filter(Organization.id == org_id).first()
            if not org:
                raise AppError(status_code=404, code="NOT_FOUND", message="Organization not found")

            updates = payload.model_dump(exclude_unset=True)
            for field, value in updates.items():
                setattr(org, field, value)

            db.commit()
            db.refresh(org)
            return org

        except AppError:
            raise
        except Exception as e:
            db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 4. Deactivate organization (owner only)
    # Sets is_active = False — does not hard delete
    # ─────────────────────────────────────────
    @staticmethod
    async def delete_organization(current_user: SupabaseUser, db: Session):
        try:
            org_id = OrgService.get_admin_org_id(current_user, db)
            org = db.query(Organization).filter(Organization.id == org_id).first()
            if not org:
                raise AppError(status_code=404, code="NOT_FOUND", message="Organization not found")

            org.is_active = False
            db.commit()
            return {"message": "Organization deactivated successfully"}

        except AppError:
            raise
        except Exception as e:
            db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))
