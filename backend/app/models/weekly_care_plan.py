import uuid
from sqlalchemy import Column, Time, DateTime, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base
from app.core.enums import WeekDay, ServiceType


class WeeklyCarePlanEntry(Base):
    """A single entry in a client's weekly care plan — one recurring block of
    planned care (day + start/end time + service), so total hours per service
    are exact and can be validated against the client's active authorizations.

    The weekly care plan has no parent row: it *is* the set of entries for a
    client. For a funded client it is the "Authorized weekly care plan" (capped
    by the funder); for a self-pay client it is simply the weekly care plan."""
    __tablename__ = "weekly_care_plan_entries"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id    = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"),
                          nullable=False)
    day_of_week  = Column(Enum(WeekDay), nullable=False)
    start_time   = Column(Time, nullable=False)
    end_time     = Column(Time, nullable=False)
    service_type = Column(Enum(ServiceType), nullable=False)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    client = relationship("Client", foreign_keys=[client_id], back_populates="weekly_care_plan_entries")
