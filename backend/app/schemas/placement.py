from datetime import datetime
from uuid import UUID
from pydantic import BaseModel
from app.core.enums import PlacementStatus


class PlacementCreateSchema(BaseModel):
    # The address and weekly care plan shown on a placement are snapshotted from
    # the client at post time (see PlacementService.create_placement) — the admin
    # only chooses the client and adds optional requirements.
    client_id:    UUID
    requirements: str | None = None


class PlacementCloseSchema(BaseModel):
    reason: str | None = None


class PlacementInterestSchema(BaseModel):
    note: str | None = None


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


class WorkerPlacementResponse(BaseModel):
    id:                UUID
    status:            PlacementStatus
    client_first_name: str
    client_last_name:  str
    masked_location:   str
    shift_description: str
    requirements:      str | None
    created_at:        datetime
    has_interest:      bool

    model_config = {"from_attributes": True}
