from pydantic import BaseModel, model_validator
from typing import Optional
from datetime import date, datetime
from uuid import UUID
from app.core.enums import LeaveType


class LeaveRecordCreateSchema(BaseModel):
    leave_type: LeaveType
    start_date: date
    end_date: date
    notes: Optional[str] = None

    @model_validator(mode="after")
    def end_not_before_start(self):
        if self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        return self


class LeaveRecordResponse(BaseModel):
    id: UUID
    worker_id: UUID
    org_id: UUID
    leave_type: LeaveType
    start_date: date
    end_date: date
    notes: Optional[str]
    recorded_by: UUID
    created_at: datetime

    model_config = {"from_attributes": True}
