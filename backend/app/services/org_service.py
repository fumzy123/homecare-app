from sqlalchemy.orm import Session
from supabase_auth.types import User as SupabaseUser
from app.models.org_member import OrgMember
from app.models.organization import Organization
from app.schemas.organization import RegisterOrganizationSchema, OrganizationUpdateSchema, RegisterDirectSchema
from app.core.enums import OrgMemberRole
from app.core.exceptions import AppError
from app.db.supabase import get_supabase_client
from app.repositories.organization_repository import OrganizationRepository
import uuid


class OrgService:

    @staticmethod
    def get_admin_org_id(current_user: SupabaseUser, db: Session) -> uuid.UUID:
        """Resolve the org_id for the currently authenticated user. Used by all services."""
        repo = OrganizationRepository(db)
        member = repo.get_member_by_id(current_user.id)
        if not member:
            raise AppError(status_code=404, code="NOT_FOUND", message="Member record not found")
        return member.org_id

    # ─────────────────────────────────────────
    # 1. Register a new organization + owner
    # ─────────────────────────────────────────
    @staticmethod
    async def register_organization(payload: RegisterOrganizationSchema, current_user: SupabaseUser, db: Session):
        supabase = get_supabase_client()
        org_id = None
        try:
            repo = OrganizationRepository(db)

            new_org = Organization(
                id=uuid.uuid4(),
                name=payload.organization_name,
                owner_id=current_user.id,
            )
            repo.add(new_org)
            repo.flush()
            org_id = new_org.id

            new_member = OrgMember(
                id=current_user.id,
                first_name=payload.first_name,
                last_name=payload.last_name,
                email=current_user.email,
                role=OrgMemberRole.owner,
                org_id=org_id,
            )
            repo.add_member(new_member)
            db.commit()

            supabase.auth.admin.update_user_by_id(
                str(current_user.id),
                {"user_metadata": {
                    "first_name": payload.first_name,
                    "last_name": payload.last_name,
                    "role": OrgMemberRole.owner.value,
                    "org_id": str(org_id),
                }},
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
            if org_id is None:
                try:
                    supabase.auth.admin.delete_user(str(current_user.id))
                except Exception:
                    pass
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 1b. Register org without email confirmation (demo bypass)
    # ─────────────────────────────────────────
    @staticmethod
    async def register_organization_direct(payload: RegisterDirectSchema, db: Session):
        supabase = get_supabase_client()
        user_id = None
        org_id = None
        try:
            repo = OrganizationRepository(db)

            result = supabase.auth.admin.create_user({
                "email": payload.email,
                "password": payload.password,
                "email_confirm": True,
            })
            user = result.user
            user_id = str(user.id)

            new_org = Organization(
                id=uuid.uuid4(),
                name=payload.organization_name,
                owner_id=user.id,
            )
            repo.add(new_org)
            repo.flush()
            org_id = new_org.id

            new_member = OrgMember(
                id=user.id,
                first_name=payload.first_name,
                last_name=payload.last_name,
                email=payload.email,
                role=OrgMemberRole.owner,
                org_id=org_id,
            )
            repo.add_member(new_member)
            db.commit()

            supabase.auth.admin.update_user_by_id(
                user_id,
                {"user_metadata": {
                    "first_name": payload.first_name,
                    "last_name": payload.last_name,
                    "role": OrgMemberRole.owner.value,
                    "org_id": str(org_id),
                }},
            )

            return {"message": "Organization registered successfully", "org_id": str(org_id), "user_id": user_id}

        except AppError:
            db.rollback()
            raise
        except Exception as e:
            db.rollback()
            if user_id and org_id is None:
                try:
                    supabase.auth.admin.delete_user(user_id)
                except Exception:
                    pass
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 2. Get the current user's organization
    # ─────────────────────────────────────────
    @staticmethod
    async def get_organization(current_user: SupabaseUser, db: Session):
        try:
            repo = OrganizationRepository(db)
            org_id = OrgService.get_admin_org_id(current_user, db)
            org = repo.get_by_id(org_id)
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
            repo = OrganizationRepository(db)
            org_id = OrgService.get_admin_org_id(current_user, db)
            org = repo.get_by_id(org_id)
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
    # ─────────────────────────────────────────
    @staticmethod
    async def delete_organization(current_user: SupabaseUser, db: Session):
        try:
            repo = OrganizationRepository(db)
            org_id = OrgService.get_admin_org_id(current_user, db)
            org = repo.get_by_id(org_id)
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
