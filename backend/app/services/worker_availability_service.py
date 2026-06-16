from datetime import time
from uuid import UUID
from sqlalchemy.orm import Session
from supabase_auth.types import User as SupabaseUser
from app.core.exceptions import AppError
from app.core.enums import WeekDay
from app.models.worker_availability import WorkerAvailabilityEntry
from app.repositories.worker_availability_repository import WorkerAvailabilityRepository
from app.repositories.employment_repository import EmploymentRepository
from app.services.org_service import OrgService
from app.schemas.worker_availability import AvailabilityPutSchema, AvailabilityEntryResponse


class WorkerAvailabilityService:
    """A worker's recurring weekly availability. Read/written as a whole set of
    interval entries, and queryable to find who can cover a given time block."""

    def __init__(self, db: Session, current_user: SupabaseUser):
        self.db = db
        self.current_user = current_user
        self.repo = WorkerAvailabilityRepository(db)
        self.employment_repo = EmploymentRepository(db)
        self.org_id = OrgService.get_user_org_id(current_user, db)

    def get_for_member(self, member_id: UUID) -> list[AvailabilityEntryResponse]:
        person_id = self._person_id(member_id)
        return [AvailabilityEntryResponse.model_validate(e) for e in self.repo.list_for_person(person_id)]

    def replace_for_member(self, member_id: UUID, payload: AvailabilityPutSchema) -> list[AvailabilityEntryResponse]:
        person_id = self._person_id(member_id)
        try:
            entries = [
                WorkerAvailabilityEntry(
                    person_id=person_id,
                    day_of_week=e.day_of_week,
                    start_time=e.start_time,
                    end_time=e.end_time,
                )
                for e in payload.entries
            ]
            self.repo.replace_for_person(person_id, entries)
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise
        return [AvailabilityEntryResponse.model_validate(e) for e in self.repo.list_for_person(person_id)]

    def available_member_ids(self, day: WeekDay, start: time, end: time) -> list[str]:
        return [str(i) for i in self.repo.available_employment_ids(self.org_id, day, start, end)]

    def _person_id(self, member_id: UUID) -> UUID:
        employment = self.employment_repo.get_active_by_id_and_org(member_id, self.org_id)
        if not employment:
            raise AppError(status_code=404, code="NOT_FOUND", message="Member not found")
        return employment.person_id
