from datetime import date
from sqlalchemy.orm import Session
from supabase_auth.types import User as SupabaseUser
from app.models.progress_note import ProgressNote
from app.schemas.progress_note import ProgressNoteUpsertSchema, ClientNoteItemResponse
from app.core.exceptions import AppError
from app.services.org_service import OrgService
from app.repositories.progress_note_repository import ProgressNoteRepository
from app.repositories.shift_repository import ShiftRepository
from app.domain.scheduling import shift_has_occurrence_on


class ProgressNoteService:

    def __init__(self, db: Session, current_user: SupabaseUser):
        self.db = db
        self.current_user = current_user
        self.note_repo = ProgressNoteRepository(db)
        self.shift_repo = ShiftRepository(db)
        self.org_id = OrgService.get_user_org_id(current_user, db)

    async def append_entry(self, shift_id, payload):
        """Append under the shared shift lock; stale writers never overwrite notes."""
        try:
            self.shift_repo.lock_shift(shift_id, self.org_id)
            shift = self.note_repo.get_shift(shift_id, self.org_id)
            note = self.note_repo.get_by_shift_and_date(shift_id, payload.occurrence_date)
            if note is None and not shift_has_occurrence_on(shift, payload.occurrence_date):
                raise AppError(404, "NOT_FOUND", "Shift occurrence not found")
            entries = list(note.entries) if note else []
            if len(entries) != payload.expected_entry_count:
                raise AppError(409, "NOTE_CHANGED", "This note changed. Review the latest entries before saving again")
            entries.append({"time": payload.time, "content": payload.content})
            if note:
                note.entries = entries
            else:
                note = ProgressNote(shift_id=shift_id, occurrence_date=payload.occurrence_date, entries=entries)
                self.note_repo.add(note)
            from app.repositories.activity_repository import ActivityRepository
            ActivityRepository(self.db).record_for_user(self.org_id, self.current_user, f'visit:{shift_id}:{payload.occurrence_date}', 'documentation',
                'Added visit note entry', str(payload.occurrence_date), {'kind': 'visit', 'record_id': str(shift_id), 'occurrence_date': payload.occurrence_date.isoformat()})
            self.db.commit()
            self.db.refresh(note)
            return note
        except Exception:
            self.db.rollback()
            raise

    # ─────────────────────────────────────────
    # 1. Get progress note for an occurrence
    # ─────────────────────────────────────────
    async def get_note(self, shift_id: str, occurrence_date: date):
        try:
            self.note_repo.get_shift(shift_id, self.org_id)
            return self.note_repo.get_by_shift_and_date(shift_id, occurrence_date)

        except AppError:
            raise
        except Exception as e:
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 2. List all notes for a client
    # ─────────────────────────────────────────
    async def get_client_notes(
        self,
        client_id: str,
        from_date: date | None = None,
        to_date: date | None = None,
    ) -> list[ClientNoteItemResponse]:
        try:
            self.note_repo.get_client(client_id, self.org_id)
            rows = self.note_repo.get_client_notes_joined(client_id, self.org_id, from_date, to_date)

            return [
                ClientNoteItemResponse(
                    shift_id=note.shift_id,
                    worker_id=worker.id,
                    occurrence_date=note.occurrence_date,
                    worker_first_name=worker.person.first_name,
                    worker_last_name=worker.person.last_name,
                    entries=note.entries,
                    created_at=note.created_at,
                    updated_at=note.updated_at,
                )
                for note, worker in rows
            ]

        except AppError:
            raise
        except Exception as e:
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 3. Upsert — create or replace entries
    # ─────────────────────────────────────────
    async def upsert_note(self, shift_id: str, payload: ProgressNoteUpsertSchema):
        try:
            self.shift_repo.lock_shift(shift_id, self.org_id)
            self.note_repo.get_shift(shift_id, self.org_id)

            note = self.note_repo.get_by_shift_and_date(shift_id, payload.occurrence_date)
            entries = [e.model_dump() for e in payload.entries]

            if note:
                note.entries = entries
            else:
                note = ProgressNote(
                    shift_id=shift_id,
                    occurrence_date=payload.occurrence_date,
                    entries=entries,
                )
                self.note_repo.add(note)

            from app.repositories.activity_repository import ActivityRepository
            ActivityRepository(self.db).record_for_user(self.org_id, self.current_user, f'visit:{shift_id}:{payload.occurrence_date}', 'documentation',
                'Saved visit notes', str(payload.occurrence_date), {'kind': 'visit', 'record_id': str(shift_id), 'occurrence_date': payload.occurrence_date.isoformat()})
            self.db.commit()
            self.db.refresh(note)
            return note

        except AppError:
            self.db.rollback()
            raise
        except Exception as e:
            self.db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))
