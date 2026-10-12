"""Admin-only recurring assignment management."""
from datetime import date
from uuid import UUID
from pydantic import BaseModel, Field, field_validator


class EndAssignments(BaseModel):
    assignment_ids: list[UUID] = Field(min_length=1, max_length=100)
    stops_from: date
    reason: str = Field(min_length=1, max_length=500)
    review_token: str | None = None

    @field_validator('reason')
    @classmethod
    def meaningful_reason(cls, value):
        if not value.strip():
            raise ValueError('Enter a reason for the assignment history')
        return value.strip()

    @field_validator('assignment_ids')
    @classmethod
    def unique_ids(cls, value):
        if len(value) != len(set(value)):
            raise ValueError('Select each assignment once')
        return value
