from sqlalchemy import Column, String, Enum, Boolean, DateTime, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base
from app.core.enums import EmploymentType


class WorkerProfile(Base):
    __tablename__ = "worker_profiles"

    # PK is also the FK — enforces 1:1 with org_members
    org_member_id = Column(UUID(as_uuid=True), ForeignKey("org_members.id"), primary_key=True)

    # Address
    street = Column(String, nullable=True)
    city = Column(String, nullable=True)
    province = Column(String, nullable=True)
    postal_code = Column(String, nullable=True)

    # Employment
    employment_type = Column(Enum(EmploymentType), nullable=True)
    has_vehicle = Column(Boolean, default=False, nullable=True)
    max_hours_per_week = Column(Integer, nullable=True)

    # Scheduling
    availability = Column(JSONB, nullable=True)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    org_member = relationship("OrgMember", back_populates="worker_profile")
