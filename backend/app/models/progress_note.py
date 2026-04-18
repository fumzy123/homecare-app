from sqlalchemy import Column, Date, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base
import uuid


class ProgressNote(Base):
    __tablename__ = "progress_notes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Which shift and which occurrence
    shift_id = Column(UUID(as_uuid=True), ForeignKey("shifts.id"), nullable=False)
    occurrence_date = Column(Date, nullable=False)

    # Array of { "time": "HH:MM", "content": "..." } objects
    entries = Column(JSONB, nullable=False, default=list)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    shift = relationship("Shift")
