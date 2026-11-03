from sqlalchemy.orm import Session
from datetime import datetime
from zoneinfo import ZoneInfo
import hashlib
import json
from app.domain.leave import affected_visits
from app.repositories.shift_repository import ShiftRepository, ShiftModificationRepository
from app.models.shift_modification import ShiftModification
from app.core.enums import ShiftCompletionStatus
from app.services.worker_notification_service import WorkerNotificationService
from supabase_auth.types import User as SupabaseUser
from app.models.leave_record import LeaveRecord
from app.schemas.leave_record import LeaveRecordCreateSchema
from app.core.exceptions import AppError
from app.repositories.organization_repository import OrganizationRepository
from app.repositories.leave_repository import LeaveRepository


class LeaveService:

    def __init__(self, db: Session, current_user: SupabaseUser):
        self.db = db
        self.current_user = current_user
        self.leave_repo = LeaveRepository(db)
        self.org_repo = OrganizationRepository(db)
        self.member = self.org_repo.get_active_employment_for_user(current_user.id)
        if not self.member:
            raise AppError(404, "NOT_FOUND", "Member record not found")
        self.org_id = self.member.org_id

    def list_leave_records(self, worker_id: str, year: int) -> list[LeaveRecord]:
        self.leave_repo.get_worker(worker_id, self.org_id)
        return self.leave_repo.list_by_worker_and_year(worker_id, self.org_id, year)

    def create_leave_record(
        self,
        worker_id: str,
        payload: LeaveRecordCreateSchema,
    ) -> LeaveRecord:
        self.leave_repo.get_worker(worker_id, self.org_id)

        self.org_repo.lock_by_id(self.org_id)
        visits, protected, review = self._review(worker_id, payload)
        if visits and payload.review_token != review['review_token']:
            raise AppError(409, 'LEAVE_REVIEW_REQUIRED', 'Review the affected visits again before recording leave.')
        record = LeaveRecord(org_id=self.org_id, worker_id=worker_id,
            leave_type=payload.leave_type, start_date=payload.start_date,
            end_date=payload.end_date, notes=payload.notes, recorded_by=self.member.id)
        try:
            self.leave_repo.add(record)
            self.db.flush()
            notifications = WorkerNotificationService(self.db, self.org_id, self.member.id)
            for shift, day, value, mod in visits:
                if mod is None:
                    mod = ShiftModification(shift_id=shift.id, original_date=day)
                    ShiftModificationRepository(self.db).add(mod)
                mod.completion_status = ShiftCompletionStatus.dropped
                mod.dropped_reason = f'Worker on leave {payload.start_date} to {payload.end_date} (leave {record.id})'
                notifications.schedule('shift_updated', shift.worker_id, shift.id, day)
            self.db.commit()
            self.db.refresh(record)
            return record
        except Exception:
            self.db.rollback()
            raise

    def _review(self, worker_id, payload):
        self.leave_repo.get_worker(worker_id, self.org_id)
        org = self.org_repo.get_by_id(self.org_id)
        now = datetime.now(ZoneInfo(org.billing_timezone or 'America/St_Johns')).replace(tzinfo=None)
        shifts = ShiftRepository(self.db).get_active_shifts_for_conflict_check(worker_id, self.org_id)
        documented = self.leave_repo.documented_occurrences([s.id for s in shifts])
        visits, protected = affected_visits(shifts, payload.start_date, payload.end_date, now, documented)
        def row(entry):
            shift, day, value, mod = entry
            return dict(shift_id=str(shift.id), occurrence_date=day.isoformat(),
                client=f'{shift.client.first_name} {shift.client.last_name}',
                start_time=value.start_time.isoformat(), end_time=value.end_time.isoformat())
        rows = sorted([row(v) for v in visits], key=lambda v: (v['start_time'], v['shift_id']))
        token = hashlib.sha256(json.dumps([str(worker_id), str(self.org_id), payload.start_date.isoformat(), payload.end_date.isoformat(), rows], sort_keys=True).encode()).hexdigest()
        return visits, protected, dict(visits=rows, protected_count=len(protected), review_token=token)

    def review_leave(self, worker_id, payload):
        return self._review(worker_id, payload)[2]

    def delete_leave_record(self, worker_id: str, leave_id: str) -> None:
        self.org_repo.lock_by_id(self.org_id)
        self.leave_repo.get_worker(worker_id, self.org_id)
        record = self.leave_repo.get_by_id_worker_org(leave_id, worker_id, self.org_id)
        self.leave_repo.delete(record)
        self.db.commit()
