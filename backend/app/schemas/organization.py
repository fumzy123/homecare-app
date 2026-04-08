from pydantic import BaseModel, EmailStr
from uuid import UUID
from datetime import datetime


class RegisterOrganizationSchema(BaseModel):
    organization_name: str
    first_name: str
    last_name: str
    email: EmailStr
    password: str


class OrganizationUpdateSchema(BaseModel):
    name: str | None = None


class OrganizationResponseSchema(BaseModel):
    id: UUID
    name: str
    owner_id: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}
