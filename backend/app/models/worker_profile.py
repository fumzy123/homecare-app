from sqlalchemy import Column, String, Enum, Boolean, DateTime, Integer, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base
from app.core.enums import EmploymentType


class WorkerProfile(Base):
    __tablename__ = "worker_profiles"

    # PK is also the FK — enforces 1:1 with org_members
    org_member_id = Column(UUID(as_uuid=True), ForeignKey("org_members.id"), primary_key=True)

    # Address
    street = Column(String, nullable=False)
    city = Column(String, nullable=False)
    province = Column(String, nullable=False)
    postal_code = Column(String, nullable=False)

    # Employment
    employment_type = Column(Enum(EmploymentType), nullable=False)
    has_vehicle = Column(Boolean, default=False, nullable=False)
    max_hours_per_week = Column(Integer, nullable=True)

    # Scheduling
    availability = Column(Text, nullable=True)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    org_member = relationship("OrgMember", back_populates="worker_profile")
