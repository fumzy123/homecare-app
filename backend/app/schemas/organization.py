from pydantic import BaseModel
from uuid import UUID
from datetime import datetime


class RegisterOrganizationSchema(BaseModel):
    organization_name: str
    first_name: str
    last_name: str


class OrganizationUpdateSchema(BaseModel):
    name:            str | None = None
    legal_name:      str | None = None
    business_number: str | None = None
    street:          str | None = None
    city:            str | None = None
    province:        str | None = None
    postal_code:     str | None = None


class OrganizationResponseSchema(BaseModel):
    id: UUID
    name: str
    owner_id: UUID
    is_active: bool
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
