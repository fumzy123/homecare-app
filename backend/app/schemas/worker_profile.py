from pydantic import BaseModel
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID
from typing import Optional, List, Any
from app.core.enums import OrgMemberRole, EmploymentType, EmploymentStatus, CredentialCategory


class WorkerProfileResponse(BaseModel):
    # Identity
    id: UUID
    first_name: str
    last_name: str
    email: str
    phone_number: Optional[str]
    gender: Optional[str]
    date_of_birth: Optional[date]
    languages: Optional[List[str]]

    # Employment
    role: OrgMemberRole
    employment_status: EmploymentStatus
    employment_type: Optional[EmploymentType]
    hire_date: Optional[date]
    has_vehicle: Optional[bool]

    # Address
    street: Optional[str]
    city: Optional[str]
    province: Optional[str]
    postal_code: Optional[str]

    # Scheduling & preferences
    availability: Optional[Any]
    max_hours_per_week: Optional[int]
    pet_tolerance: Optional[str]
    preferred_client_types: Optional[List[str]]

    # Compensation
    pay_rate: Optional[Decimal]

    # Emergency contact
    emergency_contact_name: Optional[str]
    emergency_contact_phone: Optional[str]
    emergency_contact_relationship: Optional[str]

    model_config = {"from_attributes": True}


class CredentialResponse(BaseModel):
    id: UUID
    org_member_id: UUID
    name: str
    category: Optional[CredentialCategory]
    issuer: Optional[str]
    issue_date: Optional[date]
    expiry_date: Optional[date]
    is_required: bool
    file_url: Optional[str]
    uploaded_at: Optional[datetime]

    model_config = {"from_attributes": True}


class CredentialCreateSchema(BaseModel):
    name: str
    category: Optional[CredentialCategory] = None
    issuer: Optional[str] = None
    issue_date: Optional[date] = None
    expiry_date: Optional[date] = None
    is_required: bool = False
    file_url: Optional[str] = None


class CredentialUpdateSchema(BaseModel):
    name: Optional[str] = None
    category: Optional[CredentialCategory] = None
    issuer: Optional[str] = None
    issue_date: Optional[date] = None
    expiry_date: Optional[date] = None
    is_required: Optional[bool] = None
    file_url: Optional[str] = None


class WorkerStatsResponse(BaseModel):
    hours_this_week: float
    weekly_hour_cap: Optional[int]
    hours_mtd: float
    hours_ytd: float
    overtime_mtd: float
    overtime_ytd: float
    punctuality_streak: Optional[int]
    care_log_streak: Optional[int]
