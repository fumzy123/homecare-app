import uuid
from sqlalchemy import Column, Time, DateTime, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base
from app.core.enums import WeekDay


class WorkerAvailabilityBlock(Base):
    """A single recurring weekly window a worker is available to work — concrete
    (day + start/end time), so it can be compared directly against a care block
    or shift to decide whether the worker can cover it. Availability lives on the
    Person (it follows the worker across employments)."""
    __tablename__ = "worker_availability_blocks"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    person_id   = Column(UUID(as_uuid=True), ForeignKey("persons.id", ondelete="CASCADE"),
                         nullable=False, index=True)
    day_of_week = Column(Enum(WeekDay), nullable=False)
    start_time  = Column(Time, nullable=False)
    end_time    = Column(Time, nullable=False)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    person = relationship("Person", foreign_keys=[person_id], back_populates="availability_blocks")
