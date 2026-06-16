from datetime import time
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.worker_availability import WorkerAvailabilityBlock
from app.models.employment import Employment
from app.core.enums import WeekDay, EmploymentStatus


class WorkerAvailabilityRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_for_person(self, person_id: UUID) -> list[WorkerAvailabilityBlock]:
        return (
            self.db.query(WorkerAvailabilityBlock)
            .filter(WorkerAvailabilityBlock.person_id == person_id)
            .order_by(WorkerAvailabilityBlock.day_of_week, WorkerAvailabilityBlock.start_time)
            .all()
        )

    def replace_for_person(self, person_id: UUID, blocks: list[WorkerAvailabilityBlock]) -> list[WorkerAvailabilityBlock]:
        """PUT semantics — availability is edited as a whole."""
        self.db.query(WorkerAvailabilityBlock).filter(
            WorkerAvailabilityBlock.person_id == person_id
        ).delete(synchronize_session=False)
        for block in blocks:
            self.db.add(block)
        self.db.flush()
        return blocks

    def available_employment_ids(
        self, org_id: UUID, day: WeekDay, start: time, end: time
    ) -> set[UUID]:
        """Employment ids in the org whose recurring availability covers
        [start, end) on `day` — i.e. one window that contains the whole block."""
        rows = (
            self.db.query(Employment.id)
            .join(WorkerAvailabilityBlock, WorkerAvailabilityBlock.person_id == Employment.person_id)
            .filter(
                Employment.org_id == org_id,
                Employment.deleted_at.is_(None),
                Employment.employment_status == EmploymentStatus.active,
                WorkerAvailabilityBlock.day_of_week == day,
                WorkerAvailabilityBlock.start_time <= start,
                WorkerAvailabilityBlock.end_time >= end,
            )
            .distinct()
            .all()
        )
        return {r[0] for r in rows}
