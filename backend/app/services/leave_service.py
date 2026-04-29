from sqlalchemy.orm import Session
from sqlalchemy import extract
from supabase_auth.types import User as SupabaseUser
from app.models.leave_record import LeaveRecord
from app.models.org_member import OrgMember
from app.schemas.leave_record import LeaveRecordCreateSchema
from app.services.org_service import OrgService
from app.core.exceptions import AppError


class LeaveService:

    @staticmethod
    def _get_worker(worker_id: str, org_id, db: Session) -> OrgMember:
        worker = (
            db.query(OrgMember)
            .filter(
                OrgMember.id == worker_id,
                OrgMember.org_id == org_id,
                OrgMember.deleted_at.is_(None),
            )
            .first()
        )
        if not worker:
            raise AppError(404, "WORKER_NOT_FOUND", "Worker not found")
        return worker

    @staticmethod
    def list_leave_records(
        worker_id: str,
        year: int,
        current_user: SupabaseUser,
        db: Session,
    ) -> list[LeaveRecord]:
        org_id = OrgService.get_admin_org_id(current_user, db)
        LeaveService._get_worker(worker_id, org_id, db)

        return (
            db.query(LeaveRecord)
            .filter(
                LeaveRecord.worker_id == worker_id,
                LeaveRecord.org_id == org_id,
                extract("year", LeaveRecord.start_date) == year,
            )
            .order_by(LeaveRecord.start_date.desc())
            .all()
        )

    @staticmethod
    def create_leave_record(
        worker_id: str,
        payload: LeaveRecordCreateSchema,
        current_user: SupabaseUser,
        db: Session,
    ) -> LeaveRecord:
        org_id = OrgService.get_admin_org_id(current_user, db)
        LeaveService._get_worker(worker_id, org_id, db)

        record = LeaveRecord(
            org_id=org_id,
            worker_id=worker_id,
            leave_type=payload.leave_type,
            start_date=payload.start_date,
            end_date=payload.end_date,
            notes=payload.notes,
            recorded_by=current_user.id,
        )
        db.add(record)
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
        org_id = OrgService.get_admin_org_id(current_user, db)
        LeaveService._get_worker(worker_id, org_id, db)

        record = (
            db.query(LeaveRecord)
            .filter(
                LeaveRecord.id == leave_id,
                LeaveRecord.worker_id == worker_id,
                LeaveRecord.org_id == org_id,
            )
            .first()
        )
        if not record:
            raise AppError(404, "LEAVE_RECORD_NOT_FOUND", "Leave record not found")

        db.delete(record)
        db.commit()
