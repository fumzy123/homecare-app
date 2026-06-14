import uuid
from sqlalchemy import Column, Time, DateTime, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base
from app.core.enums import WeekDay, ServiceType


class CareScheduleBlock(Base):
    """A single recurring weekly block of planned care for a client — concrete
    and service-typed, so total hours per service are exact and can be validated
    against the client's active authorizations."""
    __tablename__ = "care_schedule_blocks"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id    = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"),
                          nullable=False)
    day_of_week  = Column(Enum(WeekDay), nullable=False)
    start_time   = Column(Time, nullable=False)
    end_time     = Column(Time, nullable=False)
    service_type = Column(Enum(ServiceType), nullable=False)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    client = relationship("Client", foreign_keys=[client_id])
