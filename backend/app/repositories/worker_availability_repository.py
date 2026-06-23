from datetime import time
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.worker_availability import WorkerAvailabilityEntry
from app.models.employment import Employment
from app.core.enums import WeekDay, EmploymentStatus


class WorkerAvailabilityRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_for_person(self, person_id: UUID) -> list[WorkerAvailabilityEntry]:
        return (
            self.db.query(WorkerAvailabilityEntry)
            .filter(WorkerAvailabilityEntry.person_id == person_id)
            .order_by(WorkerAvailabilityEntry.day_of_week, WorkerAvailabilityEntry.start_time)
            .all()
        )

    def replace_for_person(self, person_id: UUID, entries: list[WorkerAvailabilityEntry]) -> list[WorkerAvailabilityEntry]:
        """PUT semantics — availability is edited as a whole."""
        self.db.query(WorkerAvailabilityEntry).filter(
            WorkerAvailabilityEntry.person_id == person_id
        ).delete(synchronize_session=False)
        for entry in entries:
            self.db.add(entry)
        self.db.flush()
        return entries

    def available_employment_ids(
        self, org_id: UUID, day: WeekDay, start: time, end: time
    ) -> set[UUID]:
        """Employment ids in the org whose recurring availability covers
        [start, end) on `day` — i.e. one entry that contains the whole block."""
        rows = (
            self.db.query(Employment.id)
            .join(WorkerAvailabilityEntry, WorkerAvailabilityEntry.person_id == Employment.person_id)
            .filter(
                Employment.org_id == org_id,
                Employment.deleted_at.is_(None),
                Employment.employment_status == EmploymentStatus.active,
                WorkerAvailabilityEntry.day_of_week == day,
                WorkerAvailabilityEntry.start_time <= start,
                WorkerAvailabilityEntry.end_time >= end,
            )
            .distinct()
            .all()
        )
        return {r[0] for r in rows}
