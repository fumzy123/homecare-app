import uuid
from sqlalchemy import Column, String, Enum, Boolean, Date, DateTime, Integer, Numeric, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base
from app.core.enums import OrgMemberRole, EmploymentStatus


class Employment(Base):
    __tablename__ = "employments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    person_id = Column(UUID(as_uuid=True), ForeignKey("persons.id"), nullable=False)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)

    # Employment period fields
    role = Column(Enum(OrgMemberRole), nullable=False)
    hire_date = Column(Date, nullable=True)
    employment_status = Column(Enum(EmploymentStatus), nullable=False, default=EmploymentStatus.active)
    employment_type = Column(String, nullable=True)
    has_vehicle = Column(Boolean, nullable=True)
    max_hours_per_week = Column(Integer, nullable=True)
    pay_rate = Column(Numeric(10, 2), nullable=True)

    # Soft delete = termination
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    person = relationship("Person", back_populates="employments")
    organization = relationship("Organization", back_populates="employments")
