import uuid
from sqlalchemy import Column, String, Enum, Date, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base
from app.core.enums import LeaveType


class LeaveRecord(Base):
    __tablename__ = "leave_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    worker_id = Column(UUID(as_uuid=True), ForeignKey("org_members.id"), nullable=False)
    leave_type = Column(Enum(LeaveType), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    notes = Column(String, nullable=True)
    recorded_by = Column(UUID(as_uuid=True), ForeignKey("org_members.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    worker = relationship("OrgMember", foreign_keys=[worker_id])
    recorder = relationship("OrgMember", foreign_keys=[recorded_by])
    organization = relationship("Organization")
