from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import require_admin
from app.schemas.progress_note import ProgressNoteUpsertSchema, ProgressNoteResponse
from app.services.progress_note_service import ProgressNoteService

router = APIRouter()


# ─────────────────────────────────────────
# 1. Get progress note for an occurrence
# Returns 404 if none exists yet
# ─────────────────────────────────────────
@router.get("/{shift_id}/notes", response_model=ProgressNoteResponse | None)
async def get_progress_note(
    shift_id: str,
    date: date = Query(..., description="Occurrence date (YYYY-MM-DD)"),
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return await ProgressNoteService.get_note(shift_id, date, current_user, db)


# ─────────────────────────────────────────
# 2. Upsert progress note entries
# Creates or fully replaces the entries array
# ─────────────────────────────────────────
@router.put("/{shift_id}/notes", response_model=ProgressNoteResponse)
async def upsert_progress_note(
    shift_id: str,
    payload: ProgressNoteUpsertSchema,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return await ProgressNoteService.upsert_note(shift_id, payload, current_user, db)
