from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import date, datetime
from uuid import UUID


class NoteEntry(BaseModel):
    time: str      # "HH:MM"
    content: str


class WorkerNoteEntryCreate(BaseModel):
    occurrence_date: date
    time: str = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    content: str = Field(min_length=1, max_length=10000)
    expected_entry_count: int = Field(ge=0)

    @field_validator("content")
    @classmethod
    def require_content(cls, value):
        value = value.strip()
        if not value:
            raise ValueError("Enter a progress note")
        return value


class RecordedNoteOccurrence(BaseModel):
    shift_id: UUID
    occurrence_date: date


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
