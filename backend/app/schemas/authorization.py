from datetime import date, datetime
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, Field, field_validator, model_validator
from app.core.enums import HoursPeriod, ServiceType, AuthorizationStatus, AuthorizationCoverage


# ── Service line items ────────────────────────────────────────────────────────

class AuthorizationServiceInput(BaseModel):
    service_type:     ServiceType
    authorized_hours: float = Field(gt=0)


class AuthorizationServiceResponse(BaseModel):
    id:               UUID
    service_type:     ServiceType
    authorized_hours: float

    model_config = {"from_attributes": True}


# ── Authorization ─────────────────────────────────────────────────────────────

class AuthorizationCreateSchema(BaseModel):
    funder:               str
    funder_file_number:   str | None = None
    authorization_number: str
    covering_start:       date
    covering_end:         date | None = None
    date_issued:          date | None = None
    authorized_by:        str | None = None
    hours_period:         HoursPeriod = HoursPeriod.bi_weekly
    client_monthly_contribution_amount: float | None = None
    invoice_to:           str | None = None
    notes:                str | None = None
    supersedes_id:        UUID | None = None   # set when amending an existing authorization
    services:             list[AuthorizationServiceInput]

    @field_validator("services")
    @classmethod
    def _at_least_one_service(cls, v: list[AuthorizationServiceInput]):
        if not v:
            raise ValueError("An authorization must have at least one service line")
        seen = {s.service_type for s in v}
        if len(seen) != len(v):
            raise ValueError("Duplicate service_type in services")
        return v

    @model_validator(mode="after")
    def _covering_window_valid(self):
        if self.covering_end and self.covering_end < self.covering_start:
            raise ValueError("covering_end must be on or after covering_start")
        return self


class AuthorizationResponse(BaseModel):
    id:                   UUID
    client_id:            UUID
    funder:               str
    funder_file_number:   str | None
    authorization_number: str
    covering_start:       date
    covering_end:         date | None
    date_issued:          date | None
    authorized_by:        str | None
    hours_period:         HoursPeriod
    client_monthly_contribution_amount: float | None
    invoice_to:           str | None
    cancelled_at:         datetime | None
    supersedes_id:        UUID | None
    notes:                str | None
    created_at:           datetime | None
    status:               AuthorizationStatus          # derived
    services:             list[AuthorizationServiceResponse]


# ── Compliance ────────────────────────────────────────────────────────────────

class ServiceCompliance(BaseModel):
    service_type:        ServiceType
    authorized_biweekly: float
    planned_biweekly:    float
    remaining:           float
    status:              Literal["within", "approaching", "exceeded"]


class AuthorizationComplianceResponse(BaseModel):
    client_id: UUID
    coverage:  AuthorizationCoverage
    services:  list[ServiceCompliance]
