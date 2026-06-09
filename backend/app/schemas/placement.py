from datetime import datetime
from uuid import UUID
from pydantic import BaseModel
from app.core.enums import PlacementStatus


class PlacementCreateSchema(BaseModel):
    client_id:         UUID
    shift_description: str
    requirements:      str | None = None
    masked_location:   str


class PlacementCloseSchema(BaseModel):
    reason: str | None = None


class PlacementFillSchema(BaseModel):
    employment_id: UUID   # the worker being selected


class InterestWorkerSummary(BaseModel):
    employment_id: UUID
    first_name:    str
    last_name:     str
    created_at:    datetime
    note:          str | None

    model_config = {"from_attributes": True}


class PlacementResponse(BaseModel):
    id:                UUID
    org_id:            UUID
    client_id:         UUID
    client_first_name: str
    client_last_name:  str
    created_by:        UUID
    shift_description: str
    requirements:      str | None
    masked_location:   str
    status:            PlacementStatus
    filled_by:         UUID | None
    resolved_at:       datetime | None
    created_at:        datetime
    interest_count:    int

    model_config = {"from_attributes": True}


class PlacementDetailResponse(PlacementResponse):
    interests: list[InterestWorkerSummary]
