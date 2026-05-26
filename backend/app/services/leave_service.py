from sqlalchemy.orm import Session
from supabase_auth.types import User as SupabaseUser
from app.models.leave_record import LeaveRecord
from app.schemas.leave_record import LeaveRecordCreateSchema
from app.services.org_service import OrgService
from app.repositories.leave_repository import LeaveRepository


class LeaveService:

    def __init__(self, db: Session, current_user: SupabaseUser):
        self.db = db
        self.current_user = current_user
        self.leave_repo = LeaveRepository(db)
        self.org_id = OrgService.get_user_org_id(current_user, db)

    def list_leave_records(self, worker_id: str, year: int) -> list[LeaveRecord]:
        self.leave_repo.get_worker(worker_id, self.org_id)
        return self.leave_repo.list_by_worker_and_year(worker_id, self.org_id, year)

    def create_leave_record(
        self,
        worker_id: str,
        payload: LeaveRecordCreateSchema,
    ) -> LeaveRecord:
        self.leave_repo.get_worker(worker_id, self.org_id)

        record = LeaveRecord(
            org_id=self.org_id,
            worker_id=worker_id,
            leave_type=payload.leave_type,
            start_date=payload.start_date,
            end_date=payload.end_date,
            notes=payload.notes,
            recorded_by=self.current_user.id,
        )
        self.leave_repo.add(record)
        self.db.commit()
        self.db.refresh(record)
        return record

    def delete_leave_record(self, worker_id: str, leave_id: str) -> None:
        self.leave_repo.get_worker(worker_id, self.org_id)
        record = self.leave_repo.get_by_id_worker_org(leave_id, worker_id, self.org_id)
        self.leave_repo.delete(record)
        self.db.commit()
