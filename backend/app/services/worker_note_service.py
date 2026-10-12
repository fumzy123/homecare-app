from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

from app.core.enums import EmploymentStatus, OrgMemberRole, ShiftCompletionStatus
from app.core.exceptions import AppError
from app.domain.scheduling import resolve_effective_occurrence, shift_has_occurrence_on
from app.models.progress_note import ProgressNote
from app.repositories.organization_repository import OrganizationRepository
from app.repositories.progress_note_repository import ProgressNoteRepository
from app.repositories.shift_repository import ShiftRepository


class WorkerNoteService:
    """Worker access to occurrence notes, with append-only writes."""

    def __init__(self, db, current_user):
        self.db = db
        self.org_repo = OrganizationRepository(db)
        self.note_repo = ProgressNoteRepository(db)
        self.shift_repo = ShiftRepository(db)
        employment = self.org_repo.get_active_employment_for_user(current_user.id)
        if (not employment or employment.employment_status != EmploymentStatus.active
                or employment.role != OrgMemberRole.home_support_worker):
            raise AppError(403, "WORKER_ACCESS_REQUIRED", "Active worker access is required")
        self.org_id = employment.org_id
        self.worker_id = employment.id
        org = self.org_repo.get_by_id(self.org_id)
        if not org or not org.is_active or org.deleted_at is not None:
            raise AppError(403, "WORKER_ACCESS_REQUIRED", "Active agency access is required")
        # Match the scheduler's legacy UTC policy; enrolled agencies choose a zone.
        self.agency_timezone = org.billing_timezone or "UTC"

    def _occurrence(self, shift_id, occurrence_date):
        shift = self.shift_repo.get_active_shift_for_worker(shift_id, self.org_id, self.worker_id)
        if not shift_has_occurrence_on(shift, occurrence_date):
            raise AppError(404, "NOT_FOUND", "Shift occurrence not found")
        modification = next((m for m in shift.modifications if m.original_date == occurrence_date), None)
        return resolve_effective_occurrence(shift, occurrence_date, modification)

    def get_note(self, shift_id, occurrence_date):
        self._occurrence(shift_id, occurrence_date)
        return self.note_repo.get_by_shift_and_date(shift_id, occurrence_date)

    def recorded_occurrences(self, from_date: date, to_date: date):
        if to_date < from_date or (to_date - from_date).days > 30:
            raise AppError(400, "INVALID_DATE_RANGE", "Choose a date range of at most 31 days")
        notes = self.note_repo.list_for_worker(self.org_id, self.worker_id, from_date, to_date)
        return [
            {"shift_id": note.shift_id, "occurrence_date": note.occurrence_date}
            for note in notes if any(entry.get("content", "").strip() for entry in note.entries)
        ]

    def add_entry(self, shift_id, payload):
        try:
            # The admin writer takes the same lock, including when no note row exists yet.
            self.shift_repo.lock_shift(shift_id, self.org_id)
            occurrence = self._occurrence(shift_id, payload.occurrence_date)
            if occurrence.completion_status not in (
                ShiftCompletionStatus.scheduled, ShiftCompletionStatus.in_progress,
                ShiftCompletionStatus.completed,
            ):
                raise AppError(409, "SHIFT_NOT_DOCUMENTABLE", "This visit cannot receive progress notes")
            start = occurrence.start_time
            if start.tzinfo is None:
                start = start.replace(tzinfo=ZoneInfo(self.agency_timezone))
            if start > datetime.now(timezone.utc):
                raise AppError(409, "SHIFT_NOT_STARTED", "Progress notes are available once the visit starts")
            note = self.note_repo.get_by_shift_and_date(shift_id, payload.occurrence_date)
            entries = list(note.entries) if note else []
            if len(entries) != payload.expected_entry_count:
                raise AppError(409, "NOTE_CHANGED", "This note changed. Review the latest entries before saving again")
            entries.append({"time": payload.time, "content": payload.content})
            if note:
                note.entries = entries
            else:
                note = ProgressNote(shift_id=shift_id, occurrence_date=payload.occurrence_date, entries=entries)
                self.note_repo.add(note)
            self.db.commit()
            self.db.refresh(note)
            return note
        except Exception:
            self.db.rollback()
            raise
