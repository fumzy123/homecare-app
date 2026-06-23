from pydantic import BaseModel, model_validator
from typing import Optional
from datetime import date, datetime
from uuid import UUID
from app.core.enums import ClientStatus, ServiceType, AuthorizationCoverage, CareArrangement


class AssignedWorkerResponse(BaseModel):
    id: UUID
    first_name: str
    last_name: str

    model_config = {"from_attributes": True}

    @model_validator(mode="before")
    @classmethod
    def flatten_person(cls, data):
        # When Pydantic receives an Employment ORM object, person fields live
        # one hop away on the Person relationship — traverse it explicitly.
        if hasattr(data, "person") and data.person is not None:
            return {"id": data.id, "first_name": data.person.first_name, "last_name": data.person.last_name}
        return data


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

    # Medical
    medical_conditions: Optional[str] = None
    allergies: Optional[str] = None
    medications: Optional[str] = None
    special_instructions: Optional[str] = None

    # Emergency Contact
    emergency_contact_name: str
    emergency_contact_phone: str
    emergency_contact_relationship: str

    # Administrative
    status: ClientStatus = ClientStatus.active
    # None → resolve from the org's default (funded if the org uses authorizations).
    care_arrangement: Optional[CareArrangement] = None
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

    # Medical
    medical_conditions: Optional[str] = None
    allergies: Optional[str] = None
    medications: Optional[str] = None
    special_instructions: Optional[str] = None

    # Emergency Contact
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relationship: Optional[str] = None

    # Administrative
    status: Optional[ClientStatus] = None
    care_arrangement: Optional[CareArrangement] = None
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

    # Medical
    medical_conditions: Optional[str]
    allergies: Optional[str]
    medications: Optional[str]
    special_instructions: Optional[str]

    # Emergency Contact
    emergency_contact_name: str
    emergency_contact_phone: str
    emergency_contact_relationship: str

    # Administrative
    status: ClientStatus
    care_arrangement: CareArrangement
    notes: Optional[str]

    # Derived from authorizations (not stored on the client)
    service_types: list[ServiceType] = []
    care_start: Optional[date] = None
    care_end: Optional[date] = None
    coverage: AuthorizationCoverage = AuthorizationCoverage.covered

    # Metadata
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    model_config = {"from_attributes": True}
