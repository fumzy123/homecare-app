from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from supabase_auth.types import User as SupabaseUser
from app.schemas.invitation import AcceptInvitationSchema, INVITE_EXPIRY_SECONDS
from app.schemas.org_member import OrgMemberUpdateSchema, OrgMemberSelfUpdateSchema
from app.models.person import Person
from app.models.employment import Employment
from app.core.enums import OrgMemberRole, EmploymentStatus, EmploymentType
from app.core.exceptions import AppError
from app.repositories.person_repository import PersonRepository
from app.repositories.employment_repository import EmploymentRepository
from app.repositories.invitation_repository import InvitationRepository

_DEFAULT_HOURS: dict[EmploymentType, int] = {
    EmploymentType.full_time: 40,
    EmploymentType.part_time: 24,
    # casual has no default cap
}

# Fields that belong to Person vs Employment — used to split update payloads
_PERSON_FIELDS = {
    "first_name", "last_name", "phone_number", "gender", "date_of_birth",
    "street", "city", "province", "postal_code", "availability", "languages",
    "pet_tolerance", "preferred_client_types",
    "emergency_contact_name", "emergency_contact_phone", "emergency_contact_relationship",
}
_EMPLOYMENT_FIELDS = {
    "role", "hire_date", "employment_status", "employment_type",
    "has_vehicle", "max_hours_per_week", "pay_rate",
}


def _flat_response(employment: Employment) -> dict:
    """Merge person + employment into the flat dict OrgMemberResponse expects."""
    person = employment.person
    return {
        "id":            employment.id,
        # Person identity
        "first_name":    person.first_name,
        "last_name":     person.last_name,
        "email":         person.email,
        "phone_number":  person.phone_number,
        "gender":        person.gender,
        "date_of_birth": person.date_of_birth,
        "street":        person.street,
        "city":          person.city,
        "province":      person.province,
        "postal_code":   person.postal_code,
        "availability":  person.availability,
        "languages":     person.languages,
        "pet_tolerance": person.pet_tolerance,
        "preferred_client_types":         person.preferred_client_types,
        "emergency_contact_name":         person.emergency_contact_name,
        "emergency_contact_phone":        person.emergency_contact_phone,
        "emergency_contact_relationship": person.emergency_contact_relationship,
        # Employment period
        "role":               employment.role,
        "hire_date":          employment.hire_date,
        "is_active":          employment.employment_status == EmploymentStatus.active,
        "employment_status":  employment.employment_status,
        "employment_type":    employment.employment_type,
        "has_vehicle":        employment.has_vehicle,
        "max_hours_per_week": employment.max_hours_per_week,
        "pay_rate":           employment.pay_rate,
        "org_id":             employment.org_id,
        "created_at":         employment.created_at,
        "updated_at":         employment.updated_at,
    }


class OrgMemberService:

    def __init__(self, db: Session, current_user: SupabaseUser, org_id=None):
        self.db = db
        self.current_user = current_user
        self.person_repo = PersonRepository(db)
        self.employment_repo = EmploymentRepository(db)
        self.invitation_repo = InvitationRepository(db)
        self.org_id = org_id

    # ─────────────────────────────────────────
    # 1. Accept invite — create Person + Employment
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

            invitation = self.invitation_repo.get_pending_by_email_and_org(
                self.current_user.email, org_id
            )
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

            # Re-hire support: find existing Person by email, or create a new one
            person = self.person_repo.get_by_email(self.current_user.email)
            if person:
                # Check they don't already have an active employment in this org
                existing_emp = self.employment_repo.get_active_by_person_id(person.id)
                if existing_emp and str(existing_emp.org_id) == str(org_id):
                    raise AppError(
                        status_code=409,
                        code="ALREADY_REGISTERED",
                        message="This invite has already been accepted",
                    )
                # Re-hire: bind new Supabase user id to existing Person
                person.supabase_user_id = self.current_user.id
            else:
                person = Person(
                    supabase_user_id=self.current_user.id,
                    first_name=payload.first_name,
                    last_name=payload.last_name,
                    email=self.current_user.email,
                )
                self.person_repo.add(person)
                self.db.flush()

            employment = Employment(
                person_id=person.id,
                org_id=org_id,
                role=role,
                employment_status=EmploymentStatus.active,
                employment_type=employment_type,
                max_hours_per_week=max_hours,
            )
            self.employment_repo.add(employment)
            invitation.accepted_at = datetime.now(timezone.utc)

            self.db.commit()
            self.db.refresh(employment)
            return _flat_response(employment)

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
            employments = self.employment_repo.get_all_active_by_org(self.org_id, role)
            return [_flat_response(e) for e in employments]

        except AppError:
            raise
        except Exception as e:
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 3. Get a single member
    # ─────────────────────────────────────────
    async def get_member(self, member_id: str):
        try:
            employment = self.employment_repo.get_active_by_id_and_org(member_id, self.org_id)
            return _flat_response(employment)

        except AppError:
            raise
        except Exception as e:
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 4. Admin updates any member in their org
    # ─────────────────────────────────────────
    async def update_member(self, member_id: str, payload: OrgMemberUpdateSchema):
        try:
            employment = self.employment_repo.get_active_by_id_and_org(member_id, self.org_id)
            person = employment.person

            updates = payload.model_dump(exclude_unset=True)
            for field, value in updates.items():
                if field == "is_active":
                    employment.employment_status = (
                        EmploymentStatus.active if value else EmploymentStatus.terminated
                    )
                elif field in _PERSON_FIELDS:
                    setattr(person, field, value)
                elif field in _EMPLOYMENT_FIELDS:
                    setattr(employment, field, value)

            self.db.commit()
            self.db.refresh(employment)
            return _flat_response(employment)

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
            employment = self.employment_repo.get_by_id(member_id)
            if not employment:
                raise AppError(status_code=404, code="NOT_FOUND", message="Member not found")

            person = employment.person
            # Verify the caller owns this employment record via supabase_user_id
            if str(person.supabase_user_id) != str(self.current_user.id):
                raise AppError(status_code=403, code="FORBIDDEN", message="You can only edit your own account")

            updates = payload.model_dump(exclude_unset=True)
            for field, value in updates.items():
                setattr(person, field, value)

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
                supabase.auth.admin.update_user_by_id(str(person.supabase_user_id), auth_update)

            self.db.commit()
            self.db.refresh(employment)
            return _flat_response(employment)

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
            employment = self.employment_repo.get_active_by_id_and_org(member_id, self.org_id)
            person = employment.person

            supabase_user_id = str(person.supabase_user_id) if person.supabase_user_id else None

            employment.deleted_at = datetime.now(timezone.utc)
            person.supabase_user_id = None
            self.db.commit()

            if supabase_user_id:
                try:
                    from app.db.supabase import get_supabase_client
                    get_supabase_client().auth.admin.delete_user(supabase_user_id)
                except Exception:
                    pass

            return {"message": "Member deleted successfully"}

        except AppError:
            self.db.rollback()
            raise
        except Exception as e:
            self.db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))
