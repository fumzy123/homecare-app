from pydantic import BaseModel, ConfigDict, Field, field_validator
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID
from typing import Optional, List
from app.core.enums import OrgMemberRole, EmploymentType, EmploymentStatus, ComplianceDocumentType
from app.schemas.worker_availability import AvailabilityEntryInput, AvailabilityEntryResponse, AvailabilityPutSchema


class WorkerProfileResponse(BaseModel):
    # Identity
    id: UUID
    agency_name: str
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
    availability: list[AvailabilityEntryResponse]
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
    person_id: UUID
    document_type: ComplianceDocumentType
    expiry_date: Optional[date]
    file_url: Optional[str]
    uploaded_at: Optional[datetime]
    verified_at: Optional[datetime]
    verified_by: Optional[UUID]

    model_config = {"from_attributes": True}


class CredentialVerifySchema(BaseModel):
    expiry_date: date


class CredentialPreviewUrlResponse(BaseModel):
    url: str


class CredentialCreateSchema(BaseModel):
    document_type: ComplianceDocumentType
    expiry_date: Optional[date] = None
    file_url: Optional[str] = None


class CredentialUpdateSchema(BaseModel):
    expiry_date: Optional[date] = None
    file_url: Optional[str] = None


class ExpiringCredentialResponse(BaseModel):
    id: UUID
    document_type: ComplianceDocumentType
    expiry_date: date
    days_remaining: int
    worker_id: UUID
    worker_first_name: str
    worker_last_name: str


class CredentialUpsertSchema(BaseModel):
    file_url: str


class WorkerProfileUpdateSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")

    phone_number: Optional[str] = None
    gender: Optional[str] = None
    street: Optional[str] = None
    city: Optional[str] = None
    province: Optional[str] = None
    postal_code: Optional[str] = None
    languages: Optional[List[str]] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relationship: Optional[str] = None
    pet_tolerance: Optional[str] = Field(default=None, max_length=200)
    has_vehicle: Optional[bool] = None


class WorkerAvailabilityEntryInput(AvailabilityEntryInput):
    model_config = ConfigDict(extra="forbid")

    @field_validator("start_time", "end_time")
    @classmethod
    def local_wall_time(cls, value):
        if value.tzinfo is not None:
            raise ValueError("Use local times without a timezone offset")
        return value


class WorkerAvailabilityUpdateSchema(AvailabilityPutSchema):
    model_config = ConfigDict(extra="forbid")
    entries: list[WorkerAvailabilityEntryInput]


class WorkerStatsResponse(BaseModel):
    hours_this_week: float
    weekly_hour_cap: Optional[int]
    hours_mtd: float
    hours_ytd: float
    overtime_mtd: float
    overtime_ytd: float
    punctuality_streak: Optional[int]
    care_log_streak: Optional[int]
