from pydantic import BaseModel, model_validator
from datetime import date, datetime
from typing import Literal
from uuid import UUID
from app.core.enums import ShiftCompletionStatus


# ─────────────────────────────────────────
# Recurrence block — included in ShiftCreateSchema when creating a recurring shift
# ─────────────────────────────────────────
class RecurrenceSchema(BaseModel):
    frequency: Literal["daily", "weekly"]
    days_of_week: list[Literal["MO", "TU", "WE", "TH", "FR", "SA", "SU"]] | None = None
    recurrence_end_date: date | None = None

    @model_validator(mode="after")
    def validate_days_of_week(self):
        if self.frequency == "weekly" and not self.days_of_week:
            raise ValueError("days_of_week is required when frequency is 'weekly'")
        return self


# ─────────────────────────────────────────
# POST /shifts — create a single or recurring shift
# ─────────────────────────────────────────
class ShiftCreateSchema(BaseModel):
    worker_id:  UUID
    client_id:  UUID
    start_time: datetime
    end_time:   datetime
    location:   str | None = None   # defaults to client's address in the service
    notes:      str | None = None
    recurrence: RecurrenceSchema | None = None  # absent = single shift

    @model_validator(mode="after")
    def validate_times(self):
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


# ─────────────────────────────────────────
# PATCH /shifts/{id} — update master shift
# ─────────────────────────────────────────
class ShiftUpdateSchema(BaseModel):
    worker_id:            UUID | None = None
    client_id:            UUID | None = None
    start_time:           datetime | None = None
    end_time:             datetime | None = None
    recurrence_end_date:  date | None = None
    location:             str | None = None
    notes:                str | None = None


# ─────────────────────────────────────────
# POST /shifts/{id}/modifications — override a specific occurrence
# ─────────────────────────────────────────
class ShiftModificationCreateSchema(BaseModel):
    original_date:     date
    new_start_time:    datetime | None = None
    new_end_time:      datetime | None = None
    completion_status: ShiftCompletionStatus | None = None
    notes:             str | None = None

    @model_validator(mode="after")
    def validate_times(self):
        if self.new_start_time and self.new_end_time:
            if self.new_end_time <= self.new_start_time:
                raise ValueError("new_end_time must be after new_start_time")
        return self


# ─────────────────────────────────────────
# PATCH /shifts/{id}/modifications/{date} — update an existing modification
# ─────────────────────────────────────────
class ShiftModificationUpdateSchema(BaseModel):
    new_start_time:    datetime | None = None
    new_end_time:      datetime | None = None
    completion_status: ShiftCompletionStatus | None = None
    notes:             str | None = None

    @model_validator(mode="after")
    def validate_times(self):
        if self.new_start_time and self.new_end_time:
            if self.new_end_time <= self.new_start_time:
                raise ValueError("new_end_time must be after new_start_time")
        return self


# ─────────────────────────────────────────
# Response schemas
# ─────────────────────────────────────────

class WorkerSummary(BaseModel):
    id:         UUID
    first_name: str
    last_name:  str
    email:      str
    model_config = {"from_attributes": True}


class ClientSummary(BaseModel):
    id:         UUID
    first_name: str
    last_name:  str
    model_config = {"from_attributes": True}


# Returned by GET /shifts — one item per expanded occurrence
class ShiftOccurrenceResponse(BaseModel):
    shift_id:          UUID
    modification_id:   UUID | None
    date:              date
    start_time:        datetime
    end_time:          datetime
    completion_status: ShiftCompletionStatus
    is_modification:   bool
    is_recurring:      bool
    worker:            WorkerSummary
    client:            ClientSummary
    location:          str | None
    notes:             str | None
    model_config = {"from_attributes": True}


# Returned by GET /shifts/stats
class ShiftStatsResponse(BaseModel):
    scheduled: int
    in_progress: int
    completed: int
    cancelled: int
    total: int


# Returned by GET /shifts/{id} — the master record
class ShiftMasterResponse(BaseModel):
    id:                  UUID
    worker_id:           UUID
    client_id:           UUID
    start_time:          datetime
    end_time:            datetime
    is_recurring:        bool
    recurrence_rule:     str | None
    recurrence_end_date: date | None
    status:              str
    location:            str | None
    notes:               str | None
    created_at:          datetime
    model_config = {"from_attributes": True}
