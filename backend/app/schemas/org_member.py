from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID
from app.core.enums import OrgMemberRole, EmploymentType, EmploymentStatus
from app.schemas.worker_availability import AvailabilityEntryResponse


class OrgMemberResponse(BaseModel):
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
    employment_status: EmploymentStatus
    employment_type: Optional[EmploymentType]
    has_vehicle: Optional[bool]
    max_hours_per_week: Optional[int]
    pay_rate: Optional[Decimal]
    street: Optional[str]
    city: Optional[str]
    province: Optional[str]
    postal_code: Optional[str]
    availability: List[AvailabilityEntryResponse] = []
    languages: Optional[List[str]]
    pet_tolerance: Optional[str]
    preferred_client_types: Optional[List[str]]
    emergency_contact_name: Optional[str]
    emergency_contact_phone: Optional[str]
    emergency_contact_relationship: Optional[str]
    org_id: UUID
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    model_config = {"from_attributes": True}


class OrgMemberUpdateSchema(BaseModel):
    """Admin updating any org member in their org."""
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone_number: Optional[str] = None
    gender: Optional[str] = None
    date_of_birth: Optional[date] = None
    hire_date: Optional[date] = None
    is_active: Optional[bool] = None
    employment_status: Optional[EmploymentStatus] = None
    employment_type: Optional[EmploymentType] = None
    has_vehicle: Optional[bool] = None
    max_hours_per_week: Optional[int] = None
    pay_rate: Optional[Decimal] = None
    street: Optional[str] = None
    city: Optional[str] = None
    province: Optional[str] = None
    postal_code: Optional[str] = None
    languages: Optional[List[str]] = None
    pet_tolerance: Optional[str] = None
    preferred_client_types: Optional[List[str]] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relationship: Optional[str] = None


class OrgMemberSelfUpdateSchema(BaseModel):
    """Member updating their own profile — self-edit only, syncs to Supabase Auth."""
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone_number: Optional[str] = None
    gender: Optional[str] = None
    date_of_birth: Optional[date] = None
