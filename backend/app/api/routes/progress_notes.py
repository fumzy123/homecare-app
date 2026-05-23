from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import require_admin
from app.schemas.progress_note import ProgressNoteUpsertSchema, ProgressNoteResponse
from app.services.progress_note_service import ProgressNoteService

router = APIRouter(prefix="/shifts", tags=["Progress Notes"])


def get_progress_note_service(
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
) -> ProgressNoteService:
    return ProgressNoteService(db, current_user)


# ─────────────────────────────────────────
# 1. Get progress note for an occurrence
# Returns None if none exists yet
# ─────────────────────────────────────────
@router.get("/{shift_id}/notes", response_model=ProgressNoteResponse | None)
async def get_progress_note(
    shift_id: str,
    date: date = Query(..., description="Occurrence date (YYYY-MM-DD)"),
    note_service: ProgressNoteService = Depends(get_progress_note_service),
):
    return await note_service.get_note(shift_id, date)


# ─────────────────────────────────────────
# 2. Upsert progress note entries
# Creates or fully replaces the entries array
# ─────────────────────────────────────────
@router.put("/{shift_id}/notes", response_model=ProgressNoteResponse)
async def upsert_progress_note(
    shift_id: str,
    payload: ProgressNoteUpsertSchema,
    note_service: ProgressNoteService = Depends(get_progress_note_service),
):
    return await note_service.upsert_note(shift_id, payload)
