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

    def __init__(self, db: Session, current_user: SupabaseUser | None = None, org_id=None):
        self.db = db
        self.current_user = current_user
        self.org_repo = OrganizationRepository(db)
        # org_id is None for register routes (user has no org yet).
        # Admin/owner factory functions resolve it and pass it in.
        self.org_id = org_id

    @staticmethod
    def get_user_org_id(current_user: SupabaseUser, db: Session) -> uuid.UUID:
        """Resolve the org_id for the currently authenticated user. Used by all services."""
        repo = OrganizationRepository(db)
        member = repo.get_member_by_id(current_user.id)
        if not member:
            raise AppError(status_code=404, code="NOT_FOUND", message="Member record not found")
        return member.org_id

    # ─────────────────────────────────────────
    # 1. Register a new organization + owner
    # ─────────────────────────────────────────
    async def register_organization(self, payload: RegisterOrganizationSchema):
        supabase = get_supabase_client()
        org_id = None
        try:
            new_org = Organization(
                id=uuid.uuid4(),
                name=payload.organization_name,
                owner_id=self.current_user.id,
            )
            self.org_repo.add(new_org)
            self.org_repo.flush()
            org_id = new_org.id

            new_member = OrgMember(
                id=self.current_user.id,
                first_name=payload.first_name,
                last_name=payload.last_name,
                email=self.current_user.email,
                role=OrgMemberRole.owner,
                org_id=org_id,
            )
            self.org_repo.add_member(new_member)
            self.db.commit()

            supabase.auth.admin.update_user_by_id(
                str(self.current_user.id),
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
                "user_id": str(self.current_user.id),
            }

        except AppError:
            self.db.rollback()
            raise
        except Exception as e:
            self.db.rollback()
            if org_id is None:
                try:
                    supabase.auth.admin.delete_user(str(self.current_user.id))
                except Exception:
                    pass
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 1b. Register org without email confirmation (demo bypass)
    # ─────────────────────────────────────────
    async def register_organization_direct(self, payload: RegisterDirectSchema):
        supabase = get_supabase_client()
        user_id = None
        org_id = None
        try:
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
            self.org_repo.add(new_org)
            self.org_repo.flush()
            org_id = new_org.id

            new_member = OrgMember(
                id=user.id,
                first_name=payload.first_name,
                last_name=payload.last_name,
                email=payload.email,
                role=OrgMemberRole.owner,
                org_id=org_id,
            )
            self.org_repo.add_member(new_member)
            self.db.commit()

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
            self.db.rollback()
            raise
        except Exception as e:
            self.db.rollback()
            if user_id and org_id is None:
                try:
                    supabase.auth.admin.delete_user(user_id)
                except Exception:
                    pass
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 2. Get the current user's organization
    # ─────────────────────────────────────────
    async def get_organization(self):
        try:
            org = self.org_repo.get_by_id(self.org_id)
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
    async def update_organization(self, payload: OrganizationUpdateSchema):
        try:
            org = self.org_repo.get_by_id(self.org_id)
            if not org:
                raise AppError(status_code=404, code="NOT_FOUND", message="Organization not found")

            updates = payload.model_dump(exclude_unset=True)
            for field, value in updates.items():
                setattr(org, field, value)

            self.db.commit()
            self.db.refresh(org)
            return org

        except AppError:
            raise
        except Exception as e:
            self.db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 4. Deactivate organization (owner only)
    # ─────────────────────────────────────────
    async def delete_organization(self):
        try:
            org = self.org_repo.get_by_id(self.org_id)
            if not org:
                raise AppError(status_code=404, code="NOT_FOUND", message="Organization not found")

            org.is_active = False
            self.db.commit()
            return {"message": "Organization deactivated successfully"}

        except AppError:
            raise
        except Exception as e:
            self.db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))
