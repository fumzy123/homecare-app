import stripe
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from supabase_auth.types import User as SupabaseUser
from app.models.person import Person
from app.models.employment import Employment
from app.models.organization import Organization
from app.schemas.organization import RegisterOrganizationSchema, OrganizationUpdateSchema, RegisterDirectSchema
from app.core.enums import OrgMemberRole, EmploymentStatus
from app.core.exceptions import AppError
from app.core.config import settings
from app.db.supabase import get_supabase_client
from app.repositories.organization_repository import OrganizationRepository
from app.repositories.person_repository import PersonRepository
from app.repositories.employment_repository import EmploymentRepository
import uuid

stripe.api_key = settings.stripe_secret_key


class OrgService:

    def __init__(self, db: Session, current_user: SupabaseUser | None = None, org_id=None):
        self.db = db
        self.current_user = current_user
        self.org_repo = OrganizationRepository(db)
        self.person_repo = PersonRepository(db)
        self.employment_repo = EmploymentRepository(db)
        self.org_id = org_id

    @staticmethod
    def get_user_org_id(current_user: SupabaseUser, db: Session) -> uuid.UUID:
        """Resolve the org_id for the currently authenticated user. Used by all services."""
        repo = OrganizationRepository(db)
        employment = repo.get_active_employment_for_user(current_user.id)
        if not employment:
            raise AppError(status_code=404, code="NOT_FOUND", message="Member record not found")
        return employment.org_id

    @staticmethod
    def get_admin_org_id(current_user: SupabaseUser, db: Session) -> uuid.UUID:
        """Alias kept for callers that use this name."""
        return OrgService.get_user_org_id(current_user, db)

    # ─────────────────────────────────────────
    # 1. Register a new organization + owner
    # ─────────────────────────────────────────
    async def register_organization(self, payload: RegisterOrganizationSchema):
        supabase = get_supabase_client()
        org_id = None
        try:
            person = Person(
                supabase_user_id=self.current_user.id,
                first_name=payload.first_name,
                last_name=payload.last_name,
                email=self.current_user.email,
            )
            self.person_repo.add(person)
            self.db.flush()

            new_org = Organization(
                id=uuid.uuid4(),
                name=payload.organization_name,
                owner_id=person.id,
            )
            self.org_repo.add(new_org)
            self.org_repo.flush()
            org_id = new_org.id

            employment = Employment(
                person_id=person.id,
                org_id=org_id,
                role=OrgMemberRole.owner,
                employment_status=EmploymentStatus.active,
            )
            self.employment_repo.add(employment)
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
        supabase_user_id = None
        org_id = None
        try:
            result = supabase.auth.admin.create_user({
                "email": payload.email,
                "password": payload.password,
                "email_confirm": True,
            })
            user = result.user
            supabase_user_id = str(user.id)

            person = Person(
                supabase_user_id=user.id,
                first_name=payload.first_name,
                last_name=payload.last_name,
                email=payload.email,
            )
            self.person_repo.add(person)
            self.db.flush()

            new_org = Organization(
                id=uuid.uuid4(),
                name=payload.organization_name,
                owner_id=person.id,
            )
            self.org_repo.add(new_org)
            self.org_repo.flush()
            org_id = new_org.id

            employment = Employment(
                person_id=person.id,
                org_id=org_id,
                role=OrgMemberRole.owner,
                employment_status=EmploymentStatus.active,
            )
            self.employment_repo.add(employment)
            self.db.commit()

            supabase.auth.admin.update_user_by_id(
                supabase_user_id,
                {"user_metadata": {
                    "first_name": payload.first_name,
                    "last_name": payload.last_name,
                    "role": OrgMemberRole.owner.value,
                    "org_id": str(org_id),
                }},
            )

            return {"message": "Organization registered successfully", "org_id": str(org_id), "user_id": supabase_user_id}

        except AppError:
            self.db.rollback()
            raise
        except Exception as e:
            self.db.rollback()
            if supabase_user_id and org_id is None:
                try:
                    supabase.auth.admin.delete_user(supabase_user_id)
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
    # 4. Delete organization (owner only)
    # ─────────────────────────────────────────
    async def delete_organization(self):
        try:
            org = self.org_repo.get_by_id(self.org_id)
            if not org:
                raise AppError(status_code=404, code="NOT_FOUND", message="Organization not found")

            active_employments = self.employment_repo.get_all_active_by_org(self.org_id)

            # Collect supabase user IDs before mutating (needed after commit)
            supabase_user_ids = []
            now = datetime.now(timezone.utc)
            for emp in active_employments:
                emp.deleted_at = now
                person = emp.person
                if person and person.supabase_user_id:
                    supabase_user_ids.append(str(person.supabase_user_id))
                    person.supabase_user_id = None

            subscription_id = org.subscription_id
            org.deleted_at = now
            org.is_active = False
            self.db.commit()

            # Cancel Stripe subscription — best-effort, org is already marked deleted
            if subscription_id:
                try:
                    stripe.Subscription.cancel(subscription_id)
                except Exception:
                    pass

            # Revoke all member Supabase auth tokens — best-effort
            supabase = get_supabase_client()
            for sid in supabase_user_ids:
                try:
                    supabase.auth.admin.delete_user(sid)
                except Exception:
                    pass

            return {"message": "Organization deleted successfully"}

        except AppError:
            self.db.rollback()
            raise
        except Exception as e:
            self.db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))
