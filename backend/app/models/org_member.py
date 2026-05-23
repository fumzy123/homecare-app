from sqlalchemy import Column, String, Enum, Boolean, DateTime, Date, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base
from app.core.enums import OrgMemberRole
import uuid

class OrgMember(Base):
    __tablename__ = "org_members"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Identity
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    phone_number = Column(String, nullable=True)
    gender = Column(String, nullable=True)
    date_of_birth = Column(Date, nullable=True)

    # Employment
    role = Column(Enum(OrgMemberRole), nullable=False)
    hire_date = Column(Date, nullable=True)
    is_active = Column(Boolean, default=True)
    employment_type = Column(String, nullable=True)
    has_vehicle = Column(Boolean, nullable=True)
    max_hours_per_week = Column(Integer, nullable=False, default=40, server_default="40")

    # Address
    street = Column(String, nullable=True)
    city = Column(String, nullable=True)
    province = Column(String, nullable=True)
    postal_code = Column(String, nullable=True)

    # Scheduling
    availability = Column(JSONB, nullable=True)

    # Emergency Contact
    emergency_contact_name = Column(String, nullable=True)
    emergency_contact_phone = Column(String, nullable=True)
    emergency_contact_relationship = Column(String, nullable=True)

    # Metadata
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Foreign key linking member to their organization
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)

    # Relationships
    organization = relationship("Organization", back_populates="members")
