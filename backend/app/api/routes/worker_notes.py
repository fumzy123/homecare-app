from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.schemas.progress_note import ProgressNoteResponse, RecordedNoteOccurrence, WorkerNoteEntryCreate
from app.services.worker_note_service import WorkerNoteService

router = APIRouter(prefix="/me", tags=["Worker — Progress notes"])


def get_worker_note_service(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    return WorkerNoteService(db, current_user)


@router.get("/notes/recorded", response_model=list[RecordedNoteOccurrence])
def get_recorded_notes(
    from_date: date = Query(...), to_date: date = Query(...),
    worker_note_service: WorkerNoteService = Depends(get_worker_note_service),
):
    return worker_note_service.recorded_occurrences(from_date, to_date)


@router.get("/shifts/{shift_id}/notes", response_model=ProgressNoteResponse | None)
def get_my_note(
    shift_id: UUID, occurrence_date: date = Query(...),
    worker_note_service: WorkerNoteService = Depends(get_worker_note_service),
):
    return worker_note_service.get_note(shift_id, occurrence_date)


@router.post("/shifts/{shift_id}/notes", response_model=ProgressNoteResponse)
def add_my_note_entry(
    shift_id: UUID, payload: WorkerNoteEntryCreate,
    worker_note_service: WorkerNoteService = Depends(get_worker_note_service),
):
    return worker_note_service.add_entry(shift_id, payload)
