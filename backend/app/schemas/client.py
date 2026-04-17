from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime
from uuid import UUID
from app.core.enums import ClientStatus, ServiceType


class AssignedWorkerResponse(BaseModel):
    id: UUID
    first_name: str
    last_name: str

    model_config = {"from_attributes": True}


class ClientCreateSchema(BaseModel):
    # Identity
    first_name: str
    last_name: str
    date_of_birth: date
    gender: Optional[str] = None
    phone_number: Optional[str] = None
    email: Optional[str] = None

    # Address
    street: str
    city: str
    province: str
    postal_code: str

    # Assignment (optional on create)
    assigned_worker_id: Optional[UUID] = None

    # Care & Medical
    service_type: ServiceType
    medical_conditions: Optional[str] = None
    allergies: Optional[str] = None
    medications: Optional[str] = None
    special_instructions: Optional[str] = None

    # Emergency Contact
    emergency_contact_name: str
    emergency_contact_phone: str
    emergency_contact_relationship: str

    # Requested Schedule
    requested_schedule: Optional[dict] = None

    # Administrative
    status: ClientStatus = ClientStatus.active
    care_start_date: date
    care_end_date: Optional[date] = None
    funding_source: Optional[str] = None
    notes: Optional[str] = None


class ClientUpdateSchema(BaseModel):
    # Identity
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    phone_number: Optional[str] = None
    email: Optional[str] = None

    # Address
    street: Optional[str] = None
    city: Optional[str] = None
    province: Optional[str] = None
    postal_code: Optional[str] = None

    # Assignment
    assigned_worker_id: Optional[UUID] = None

    # Care & Medical
    service_type: Optional[ServiceType] = None
    medical_conditions: Optional[str] = None
    allergies: Optional[str] = None
    medications: Optional[str] = None
    special_instructions: Optional[str] = None

    # Emergency Contact
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relationship: Optional[str] = None

    # Requested Schedule
    requested_schedule: Optional[dict] = None

    # Administrative
    status: Optional[ClientStatus] = None
    care_start_date: Optional[date] = None
    care_end_date: Optional[date] = None
    funding_source: Optional[str] = None
    notes: Optional[str] = None


class ClientResponse(BaseModel):
    id: UUID

    # Identity
    first_name: str
    last_name: str
    date_of_birth: date
    gender: Optional[str]
    phone_number: Optional[str]
    email: Optional[str]

    # Address
    street: str
    city: str
    province: str
    postal_code: str

    # Organization & Assignment
    org_id: UUID
    assigned_worker_id: Optional[UUID]
    assigned_worker: Optional[AssignedWorkerResponse]

    # Care & Medical
    service_type: ServiceType
    medical_conditions: Optional[str]
    allergies: Optional[str]
    medications: Optional[str]
    special_instructions: Optional[str]

    # Emergency Contact
    emergency_contact_name: str
    emergency_contact_phone: str
    emergency_contact_relationship: str

    # Requested Schedule
    requested_schedule: Optional[dict]

    # Administrative
    status: ClientStatus
    care_start_date: date
    care_end_date: Optional[date]
    funding_source: Optional[str]
    notes: Optional[str]

    # Metadata
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    model_config = {"from_attributes": True}
