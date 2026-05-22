from datetime import date
from sqlalchemy.orm import Session
from supabase_auth.types import User as SupabaseUser
from app.models.progress_note import ProgressNote
from app.schemas.progress_note import ProgressNoteUpsertSchema, ClientNoteItemResponse
from app.core.exceptions import AppError
from app.services.org_service import OrgService
from app.repositories.progress_note_repository import ProgressNoteRepository


class ProgressNoteService:

    # ─────────────────────────────────────────
    # 1. Get progress note for an occurrence
    # ─────────────────────────────────────────
    @staticmethod
    async def get_note(shift_id: str, occurrence_date: date, current_user: SupabaseUser, db: Session):
        try:
            repo = ProgressNoteRepository(db)
            org_id = OrgService.get_admin_org_id(current_user, db)
            repo.get_shift(shift_id, org_id)
            return repo.get_by_shift_and_date(shift_id, occurrence_date)

        except AppError:
            raise
        except Exception as e:
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 2. List all notes for a client
    # ─────────────────────────────────────────
    @staticmethod
    async def get_client_notes(
        client_id: str,
        year: int | None,
        current_user: SupabaseUser,
        db: Session,
    ) -> list[ClientNoteItemResponse]:
        try:
            repo = ProgressNoteRepository(db)
            org_id = OrgService.get_admin_org_id(current_user, db)
            repo.get_client(client_id, org_id)

            rows = repo.get_client_notes_joined(client_id, org_id, year)

            return [
                ClientNoteItemResponse(
                    shift_id=note.shift_id,
                    occurrence_date=note.occurrence_date,
                    worker_first_name=worker.first_name,
                    worker_last_name=worker.last_name,
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
    @staticmethod
    async def upsert_note(shift_id: str, payload: ProgressNoteUpsertSchema, current_user: SupabaseUser, db: Session):
        try:
            repo = ProgressNoteRepository(db)
            org_id = OrgService.get_admin_org_id(current_user, db)
            repo.get_shift(shift_id, org_id)

            note = repo.get_by_shift_and_date(shift_id, payload.occurrence_date)
            entries = [e.model_dump() for e in payload.entries]

            if note:
                note.entries = entries
            else:
                note = ProgressNote(
                    shift_id=shift_id,
                    occurrence_date=payload.occurrence_date,
                    entries=entries,
                )
                repo.add(note)

            db.commit()
            db.refresh(note)
            return note

        except AppError:
            db.rollback()
            raise
        except Exception as e:
            db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))
