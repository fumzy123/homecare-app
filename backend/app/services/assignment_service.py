from datetime import datetime, timezone
from zoneinfo import ZoneInfo
import hashlib
import json
from app.core.enums import PlacementStatus
from app.core.exceptions import AppError
from app.domain.assignments import validate_cutoff, stop_scheduled_visits
from app.repositories.assignment_repository import AssignmentRepository
from app.repositories.organization_repository import OrganizationRepository
from app.repositories.activity_repository import ActivityRepository
from app.services.billing_cutoff_service import BillingCutoffService
from app.services.billing_evidence_service import BillingEvidenceService
from app.services.worker_notification_service import WorkerNotificationService


class AssignmentService:
    def __init__(self, db, current_user, org_id):
        self.db, self.current_user, self.org_id = db, current_user, org_id
        self.assignment_repo = AssignmentRepository(db)
        self.org_repo = OrganizationRepository(db)
        self.cutoff_service = BillingCutoffService(db)
        self.member = self.org_repo.get_active_employment_for_user(current_user.id)
        if not self.member or self.member.org_id != org_id:
            raise AppError(404, 'NOT_FOUND', 'Member record not found')

    def _now(self, org):
        return datetime.now(ZoneInfo(org.billing_timezone or 'America/St_Johns')).replace(tzinfo=None)

    @staticmethod
    def _row(a, today):
        p, slot = a.placement, a.care_slot
        need = p.weekly_care_need
        stop = a.ends_before
        natural_end = need.ends_on if need else None
        ended = (stop and stop <= today) or (natural_end and natural_end < today)
        return dict(id=str(a.id), client_id=str(p.client_id), client_name=f'{p.client.first_name} {p.client.last_name}',
            worker_id=str(a.employment_id), worker_name=f'{a.employment.person.first_name} {a.employment.person.last_name}',
            placement_id=str(p.id), care_slot_id=str(a.care_slot_id), day_of_week=slot.day_of_week.value,
            start_time=slot.start_time.isoformat(), end_time=slot.end_time.isoformat(), service_type=slot.service_type.value,
            starts_on=a.starts_on, stops_from=stop, revision_ends_on=natural_end, end_reason=a.end_reason,
            ended_at=a.ended_at, ended_by=str(a.ended_by) if a.ended_by else None,
            status='ended' if ended else 'ending' if stop else 'scheduled' if a.starts_on > today else 'active',
            can_end=not stop and not natural_end)

    def list_assignments(self, worker_id=None, client_id=None):
        if not worker_id and not client_id:
            raise AppError(400, 'ASSIGNMENT_FILTER_REQUIRED', 'Choose a worker or client')
        org = self.org_repo.get_by_id(self.org_id)
        today = self._now(org).date()
        return {'today': today, 'assignments': [self._row(a, today) for a in self.assignment_repo.list(self.org_id, worker_id, client_id)]}

    def _review(self, payload):
        org = self.org_repo.lock_by_id(self.org_id)
        now = self._now(org)
        if payload.stops_from < now.date():
            raise AppError(400, 'PAST_STOP_DATE', 'Assignments cannot be ended in the past')
        rows = self.assignment_repo.lock_selected(self.org_id, payload.assignment_ids)
        if len(rows) != len(payload.assignment_ids):
            raise AppError(404, 'NOT_FOUND', 'Assignment not found')
        if len({(a.placement_id, a.employment_id) for a in rows}) != 1:
            raise AppError(400, 'MIXED_ASSIGNMENTS', 'Manage one worker and care request at a time')
        for a in rows:
            if a.ends_before is not None or a.placement.weekly_care_need.ends_on:
                raise AppError(409, 'ASSIGNMENT_CHANGED', 'This assignment already ends. Refresh its history.')
            if payload.stops_from < a.starts_on:
                raise AppError(400, 'BEFORE_ASSIGNMENT_START', 'Choose the assignment start date or a later stop date')
        shifts = self.assignment_repo.lock_shifts(self.org_id, payload.assignment_ids)
        if any(not any(s.assignment_id == a.id for s in shifts) for a in rows):
            raise AppError(409, 'ASSIGNMENT_SCHEDULE_MISSING', 'The linked schedule needs review before ending this assignment')
        notes = self.assignment_repo.notes(self.org_id, [s.id for s in shifts])
        validate_cutoff(shifts, notes, payload.stops_from, now)
        fingerprint = [str(payload.stops_from), payload.reason,
            [(str(a.id), str(a.starts_on), str(a.ends_before)) for a in rows],
            [(str(s.id), str(s.updated_at), str(s.start_time), str(s.end_time), str(s.recurrence_end_date), str(s.status),
              [(str(m.id), str(m.updated_at), str(m.completion_status), str(m.new_start_time), str(m.new_end_time)) for m in sorted(s.modifications, key=lambda m: str(m.id))]) for s in shifts],
            sorted((str(n.id), str(n.updated_at), str(n.occurrence_date)) for n in notes)]
        token = hashlib.sha256(json.dumps(fingerprint).encode()).hexdigest()
        review = dict(review_token=token, stops_from=payload.stops_from,
                      assignments=[self._row(a, now.date()) for a in rows], series_count=len(shifts))
        return rows, shifts, review

    def review_end(self, payload):
        try:
            return self._review(payload)[2]
        finally:
            self.db.rollback()

    def end_assignments(self, payload):
        try:
            self.cutoff_service.seal_due(self.org_id)
            rows, shifts, review = self._review(payload)
            if not payload.review_token or payload.review_token != review['review_token']:
                raise AppError(409, 'ASSIGNMENT_REVIEW_REQUIRED', 'The assignment changed. Review the stop date and visits again.')
            for shift in shifts:
                BillingEvidenceService(self.db, self.org_id).preserve(shift)
            stop_scheduled_visits(shifts, payload.stops_from)
            for a in rows:
                a.ends_before, a.ended_at = payload.stops_from, datetime.now(timezone.utc)
                a.ended_by, a.end_reason = self.member.id, payload.reason
            p = rows[0].placement
            # Reuse the existing care request and approval checks for replacements.
            if p.client.deleted_at is None and p.client.status.value == 'active':
                p.status, p.resolved_at, p.filled_by = PlacementStatus.open, None, None
            ActivityRepository(self.db).record(self.org_id, self.member.id, f'care:{p.weekly_care_need_id}', 'coverage',
                'Replacement worker needed', f'{len(rows)} care slots · Visits stop from {payload.stops_from}',
                {'kind': 'placement', 'record_id': str(p.id)})
            WorkerNotificationService(self.db, self.org_id, self.member.id).schedule(
                'shift_updated', rows[0].employment_id, occurrence_date=payload.stops_from)
            self.db.commit()
            return {'placement_id': str(p.id), 'ended_count': len(rows), 'stops_from': payload.stops_from}
        except Exception:
            self.db.rollback()
            raise
