from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime
from uuid import UUID
from app.core.enums import OrgMemberRole, EmploymentType


class WorkerProfileCreateSchema(BaseModel):
    # Address
    street: Optional[str] = None
    city: Optional[str] = None
    province: Optional[str] = None
    postal_code: Optional[str] = None

    # Employment
    employment_type: Optional[EmploymentType] = None
    has_vehicle: Optional[bool] = None
    max_hours_per_week: Optional[int] = None

    # Scheduling
    availability: Optional[str] = None


class WorkerProfileUpdateSchema(BaseModel):
    # Address
    street: Optional[str] = None
    city: Optional[str] = None
    province: Optional[str] = None
    postal_code: Optional[str] = None

    # Employment
    employment_type: Optional[EmploymentType] = None
    has_vehicle: Optional[bool] = None
    max_hours_per_week: Optional[int] = None

    # Scheduling
    availability: Optional[str] = None


class OrgMemberUpdateSchema(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone_number: Optional[str] = None
    gender: Optional[str] = None
    date_of_birth: Optional[date] = None
    hire_date: Optional[date] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relationship: Optional[str] = None


class WorkerProfileResponse(BaseModel):
    org_member_id: UUID
    street: Optional[str]
    city: Optional[str]
    province: Optional[str]
    postal_code: Optional[str]
    employment_type: Optional[EmploymentType]
    has_vehicle: Optional[bool]
    max_hours_per_week: Optional[int]
    availability: Optional[str]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    model_config = {"from_attributes": True}


class WorkerResponse(BaseModel):
    # From OrgMember
    id: UUID
    first_name: str
    last_name: str
    email: str
    phone_number: Optional[str]
    gender: Optional[str]
    date_of_birth: Optional[date]
    role: OrgMemberRole
    hire_date: Optional[date]
    is_active: bool
    emergency_contact_name: Optional[str]
    emergency_contact_phone: Optional[str]
    emergency_contact_relationship: Optional[str]
    org_id: UUID
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    # From WorkerProfile (nested)
    worker_profile: Optional[WorkerProfileResponse]

    model_config = {"from_attributes": True}
