from sqlalchemy.orm import Session
from supabase_auth.types import User as SupabaseUser
from app.models.leave_record import LeaveRecord
from app.schemas.leave_record import LeaveRecordCreateSchema
from app.services.org_service import OrgService
from app.repositories.leave_repository import LeaveRepository


class LeaveService:

    @staticmethod
    def list_leave_records(
        worker_id: str,
        year: int,
        current_user: SupabaseUser,
        db: Session,
    ) -> list[LeaveRecord]:
        repo = LeaveRepository(db)
        org_id = OrgService.get_admin_org_id(current_user, db)
        repo.get_worker(worker_id, org_id)
        return repo.list_by_worker_and_year(worker_id, org_id, year)

    @staticmethod
    def create_leave_record(
        worker_id: str,
        payload: LeaveRecordCreateSchema,
        current_user: SupabaseUser,
        db: Session,
    ) -> LeaveRecord:
        repo = LeaveRepository(db)
        org_id = OrgService.get_admin_org_id(current_user, db)
        repo.get_worker(worker_id, org_id)

        record = LeaveRecord(
            org_id=org_id,
            worker_id=worker_id,
            leave_type=payload.leave_type,
            start_date=payload.start_date,
            end_date=payload.end_date,
            notes=payload.notes,
            recorded_by=current_user.id,
        )
        repo.add(record)
        db.commit()
        db.refresh(record)
        return record

    @staticmethod
    def delete_leave_record(
        worker_id: str,
        leave_id: str,
        current_user: SupabaseUser,
        db: Session,
    ) -> None:
        repo = LeaveRepository(db)
        org_id = OrgService.get_admin_org_id(current_user, db)
        repo.get_worker(worker_id, org_id)
        record = repo.get_by_id_worker_org(leave_id, worker_id, org_id)
        repo.delete(record)
        db.commit()
