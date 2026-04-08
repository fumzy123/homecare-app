from sqlalchemy import Column, String, Date, DateTime, ForeignKey, Enum, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base
from app.core.enums import ClientStatus, ServiceType
import uuid

class Client(Base):
    __tablename__ = "clients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Identity
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    date_of_birth = Column(Date, nullable=False)
    gender = Column(String, nullable=True)
    phone_number = Column(String, nullable=True)
    email = Column(String, nullable=True)

    # Address
    street = Column(String, nullable=False)
    city = Column(String, nullable=False)
    province = Column(String, nullable=False)
    postal_code = Column(String, nullable=False)

    # Organization & Assignment
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    assigned_worker_id = Column(UUID(as_uuid=True), ForeignKey("org_members.id"), nullable=True)

    # Care & Medical
    service_type = Column(Enum(ServiceType), nullable=False)
    medical_conditions = Column(Text, nullable=True)
    allergies = Column(Text, nullable=True)
    medications = Column(Text, nullable=True)
    special_instructions = Column(Text, nullable=True)

    # Emergency Contact
    emergency_contact_name = Column(String, nullable=False)
    emergency_contact_phone = Column(String, nullable=False)
    emergency_contact_relationship = Column(String, nullable=False)

    # Administrative
    status = Column(Enum(ClientStatus), nullable=False, default=ClientStatus.active)
    care_start_date = Column(Date, nullable=False)
    care_end_date = Column(Date, nullable=True)
    funding_source = Column(String, nullable=True)
    notes = Column(Text, nullable=True)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    organization = relationship("Organization", back_populates="clients")
    assigned_worker = relationship("OrgMember")
