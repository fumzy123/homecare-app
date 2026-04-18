from datetime import date
from sqlalchemy.orm import Session
from supabase_auth.types import User as SupabaseUser
from app.models.progress_note import ProgressNote
from app.models.shift import Shift
from app.schemas.progress_note import ProgressNoteUpsertSchema
from app.core.exceptions import AppError
from app.services.org_service import OrgService


class ProgressNoteService:

    @staticmethod
    def _get_shift(shift_id: str, org_id, db: Session) -> Shift:
        shift = db.query(Shift).filter(
            Shift.id == shift_id,
            Shift.org_id == org_id,
            Shift.deleted_at == None,  # noqa: E711
        ).first()
        if not shift:
            raise AppError(status_code=404, code="NOT_FOUND", message="Shift not found")
        return shift

    # ─────────────────────────────────────────
    # 1. Get progress note for an occurrence
    # Returns None if no note exists yet
    # ─────────────────────────────────────────
    @staticmethod
    async def get_note(shift_id: str, occurrence_date: date, current_user: SupabaseUser, db: Session):
        try:
            org_id = OrgService.get_admin_org_id(current_user, db)
            ProgressNoteService._get_shift(shift_id, org_id, db)

            return db.query(ProgressNote).filter(
                ProgressNote.shift_id == shift_id,
                ProgressNote.occurrence_date == occurrence_date,
            ).first()

        except AppError:
            raise
        except Exception as e:
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 2. Upsert — create or replace entries
    # ─────────────────────────────────────────
    @staticmethod
    async def upsert_note(shift_id: str, payload: ProgressNoteUpsertSchema, current_user: SupabaseUser, db: Session):
        try:
            org_id = OrgService.get_admin_org_id(current_user, db)
            ProgressNoteService._get_shift(shift_id, org_id, db)

            note = db.query(ProgressNote).filter(
                ProgressNote.shift_id == shift_id,
                ProgressNote.occurrence_date == payload.occurrence_date,
            ).first()

            entries = [e.model_dump() for e in payload.entries]

            if note:
                note.entries = entries
            else:
                note = ProgressNote(
                    shift_id=shift_id,
                    occurrence_date=payload.occurrence_date,
                    entries=entries,
                )
                db.add(note)

            db.commit()
            db.refresh(note)
            return note

        except AppError:
            db.rollback()
            raise
        except Exception as e:
            db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))
