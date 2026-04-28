from sqlalchemy import Column, Date, DateTime, Text, ForeignKey, Enum, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base
from app.core.enums import ShiftCompletionStatus
import uuid


class ShiftModification(Base):
    __tablename__ = "shift_modifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Which master shift this modifies
    shift_id = Column(UUID(as_uuid=True), ForeignKey("shifts.id"), nullable=False)

    # Which occurrence date this applies to (the original scheduled date, not the new one)
    original_date = Column(Date, nullable=False)

    # Time overrides — NULL means "inherit from master shift"
    new_start_time = Column(DateTime(timezone=True), nullable=True)
    new_end_time = Column(DateTime(timezone=True), nullable=True)

    # Per-occurrence lifecycle status
    completion_status = Column(
        Enum(ShiftCompletionStatus),
        nullable=False,
        default=ShiftCompletionStatus.scheduled
    )

    notes = Column(Text, nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    cancellation_reason = Column(Text, nullable=True)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # One modification per occurrence per master shift
    __table_args__ = (
        UniqueConstraint("shift_id", "original_date", name="uq_shift_modification_per_occurrence"),
    )

    # Relationships
    shift = relationship("Shift", back_populates="modifications")
