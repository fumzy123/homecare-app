from datetime import datetime, date
from uuid import UUID
from pydantic import BaseModel
from app.core.enums import PlacementStatus


class PlacementCreateSchema(BaseModel):
    # The address and weekly care plan shown on a placement are snapshotted from
    # the client at post time (see PlacementService.create_placement) — the admin
    # chooses the client, when care starts, and optional requirements.
    client_id:    UUID
    start_date:   date
    requirements: str | None = None


class PlacementCloseSchema(BaseModel):
    reason: str | None = None


class PlacementInterestSchema(BaseModel):
    note: str | None = None


class PlacementFillSchema(BaseModel):
    employment_id: UUID   # the worker being selected


class InterestEligibility(BaseModel):
    """Whether this worker can actually be assigned the placement's care plan —
    computed fresh on read. Fill is gated on `all_clear`."""
    availability_ok: bool
    no_conflicts:    bool
    within_hours:    bool
    all_clear:       bool
    reasons:         list[str]   # human-readable blockers (empty when all_clear)


class InterestWorkerSummary(BaseModel):
    employment_id: UUID
    first_name:    str
    last_name:     str
    created_at:    datetime
    note:          str | None
    eligibility:   InterestEligibility | None = None

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
    start_date:        date | None
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
    start_date:        date | None
    created_at:        datetime
    has_interest:      bool

    model_config = {"from_attributes": True}
