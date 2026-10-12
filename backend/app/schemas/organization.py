from pydantic import BaseModel, field_validator
from app.domain.billing_periods import validate_billing_timezone
from uuid import UUID
from datetime import datetime


class RegisterOrganizationSchema(BaseModel):
    organization_name: str
    first_name: str
    last_name: str
    agency_timezone: str | None = None

    @field_validator('agency_timezone')
    @classmethod
    def valid_timezone(cls, value: str | None) -> str | None:
        return validate_billing_timezone(value) if value is not None else None


class OrganizationUpdateSchema(BaseModel):
    name:            str | None = None
    legal_name:      str | None = None
    business_number: str | None = None
    street:          str | None = None
    city:            str | None = None
    province:        str | None = None
    postal_code:     str | None = None
    uses_authorizations: bool | None = None


class OrganizationResponseSchema(BaseModel):
    id: UUID
    name: str
    owner_id: UUID
    is_active: bool
    uses_authorizations: bool = False
    legal_name:      str | None = None
    business_number: str | None = None
    street:          str | None = None
    city:            str | None = None
    province:        str | None = None
    postal_code:     str | None = None
    terms_accepted_at: datetime | None = None
    terms_accepted_version: str | None = None
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}
