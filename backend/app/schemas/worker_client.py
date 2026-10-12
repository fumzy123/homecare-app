from datetime import date
from uuid import UUID

from pydantic import BaseModel

from app.core.enums import ClientStatus


class WorkerClientSummary(BaseModel):
    id: UUID
    first_name: str
    last_name: str
    city: str
    status: ClientStatus
    model_config = {"from_attributes": True}


class WorkerClientProfile(WorkerClientSummary):
    """Care-facing fields only; agency notes and financial data stay private."""

    date_of_birth: date
    street: str
    province: str
    postal_code: str
    phone_number: str | None
    medical_conditions: str | None
    allergies: str | None
    medications: str | None
    special_instructions: str | None
    emergency_contact_name: str
    emergency_contact_phone: str
    emergency_contact_relationship: str
