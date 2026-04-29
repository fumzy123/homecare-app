from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime
from uuid import UUID


class NoteEntry(BaseModel):
    time: str      # "HH:MM"
    content: str


class ProgressNoteUpsertSchema(BaseModel):
    occurrence_date: date
    entries: list[NoteEntry]


class ProgressNoteResponse(BaseModel):
    id: UUID
    shift_id: UUID
    occurrence_date: date
    entries: list[NoteEntry]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    model_config = {"from_attributes": True}


class ClientNoteItemResponse(BaseModel):
    """One progress note occurrence, enriched with worker identity."""
    shift_id: UUID
    occurrence_date: date
    worker_first_name: str
    worker_last_name: str
    entries: list[NoteEntry]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
