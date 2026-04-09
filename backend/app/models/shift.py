from sqlalchemy import Column, String, Boolean, Integer, Date, DateTime, Text, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base
from app.core.enums import ShiftStatus
import uuid


class Shift(Base):
    __tablename__ = "shifts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Tenant isolation
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)

    # Assignments
    worker_id = Column(UUID(as_uuid=True), ForeignKey("org_members.id"), nullable=False)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("org_members.id"), nullable=False)

    # Shift timing — first occurrence (or the only occurrence if non-recurring)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)

    # Recurrence
    is_recurring = Column(Boolean, nullable=False, default=False)
    recurrence_rule = Column(Text, nullable=True)         # e.g. "FREQ=WEEKLY;BYDAY=MO,WE,FR"
    recurrence_end_date = Column(Date, nullable=True)     # when the schedule stops generating occurrences

    # Master status — "active" or "cancelled" (cancels the entire schedule)
    status = Column(Enum(ShiftStatus), nullable=False, default=ShiftStatus.active)

    notes = Column(Text, nullable=True)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    worker = relationship("OrgMember", foreign_keys=[worker_id])
    client = relationship("Client", foreign_keys=[client_id])
    creator = relationship("OrgMember", foreign_keys=[created_by])
    modifications = relationship("ShiftModification", back_populates="shift")
