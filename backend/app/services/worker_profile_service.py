from app.core.enums import EmploymentStatus, OrgMemberRole
from app.core.exceptions import AppError
from app.db.session import SessionLocal
from app.models.worker_availability import WorkerAvailabilityEntry
from app.repositories.organization_repository import OrganizationRepository
from app.repositories.person_repository import PersonRepository
from app.repositories.credential_repository import CredentialRepository
from app.repositories.worker_availability_repository import WorkerAvailabilityRepository
from app.schemas.worker_profile import WorkerProfileResponse
from app.services.notification_service import NotificationService


def notify_profile_update(org_id, worker_id, changed_fields):
    with SessionLocal() as db:
        NotificationService(db).notify_profile_updated(org_id, worker_id, changed_fields)


def notify_credential_upload(org_id, worker_id, document_type):
    with SessionLocal() as db:
        NotificationService(db).notify_credential_uploaded(org_id, worker_id, document_type)


class WorkerProfileService:
    """Self-service profile access. Identity always comes from the signed-in user."""

    PERSON_FIELDS = (
        "first_name", "last_name", "email", "phone_number", "gender", "date_of_birth",
        "languages", "street", "city", "province", "postal_code", "pet_tolerance",
        "preferred_client_types", "emergency_contact_name", "emergency_contact_phone",
        "emergency_contact_relationship",
    )
    EMPLOYMENT_FIELDS = (
        "id", "role", "employment_status", "employment_type", "hire_date",
        "has_vehicle", "max_hours_per_week", "pay_rate",
    )

    def __init__(self, db, current_user):
        self.db = db
        self.org_repo = OrganizationRepository(db)
        self.person_repo = PersonRepository(db)
        self.credential_repo = CredentialRepository(db)
        self.availability_repo = WorkerAvailabilityRepository(db)
        self.employment = self.org_repo.get_active_employment_for_user(current_user.id)
        if (not self.employment or self.employment.role != OrgMemberRole.home_support_worker
                or self.employment.employment_status not in (EmploymentStatus.active, EmploymentStatus.on_leave)):
            raise AppError(403, "WORKER_ACCESS_REQUIRED", "Worker access is required")
        self.org_id = self.employment.org_id
        self.org = self.org_repo.get_by_id(self.org_id)
        if not self.org or not self.org.is_active or self.org.deleted_at is not None:
            raise AppError(403, "WORKER_ACCESS_REQUIRED", "Active agency access is required")
        self.person = self.person_repo.get_by_id(self.employment.person_id)
        if not self.person:
            raise AppError(404, "NOT_FOUND", "Profile not found")

    def get_profile(self):
        return WorkerProfileResponse.model_validate({
            **{key: getattr(self.person, key) for key in self.PERSON_FIELDS},
            **{key: getattr(self.employment, key) for key in self.EMPLOYMENT_FIELDS},
            "agency_name": self.org.name,
            "availability": self.availability_repo.list_for_person(self.person.id),
        })

    def update_profile(self, payload, background_tasks):
        changed = []
        try:
            for key, value in payload.model_dump(exclude_unset=True).items():
                target = self.employment if key == "has_vehicle" else self.person
                if getattr(target, key) != value:
                    changed.append(key)
                    setattr(target, key, value)
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise
        if changed:
            background_tasks.add_task(notify_profile_update, self.org_id, self.employment.id, changed)
        return self.get_profile()

    def update_availability(self, payload, background_tasks):
        try:
            entries = [WorkerAvailabilityEntry(person_id=self.person.id, **entry.model_dump())
                       for entry in payload.entries]
            self.availability_repo.replace_for_person(self.person.id, entries)
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise
        background_tasks.add_task(notify_profile_update, self.org_id, self.employment.id, ["availability"])
        return self.get_profile()

    def list_credentials(self):
        return self.credential_repo.list_for_member(self.person.id)

    def upsert_credential(self, document_type, payload, background_tasks):
        try:
            credential = self.credential_repo.upsert_for_member(self.person.id, document_type, payload.file_url)
            self.db.commit()
            self.db.refresh(credential)
        except Exception:
            self.db.rollback()
            raise
        background_tasks.add_task(notify_credential_upload, self.org_id, self.employment.id, document_type.value)
        return credential
