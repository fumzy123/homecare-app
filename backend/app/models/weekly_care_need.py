import uuid
from sqlalchemy import (
    Column,
    Boolean,
    false,
    Time,
    DateTime,
    Date,
    Integer,
    ForeignKey,
    Enum,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base
from app.core.enums import WeekDay, ServiceType


class WeeklyCareNeed(Base):
    """An immutable version of a client's weekly requirements; approval activates coverage."""

    __tablename__ = "weekly_care_needs"
    __table_args__ = (
        UniqueConstraint("client_id", "version", name="uq_care_need_client_version"),
    )
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(
        UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False, index=True
    )
    org_id = Column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True
    )
    version = Column(Integer, nullable=False)
    imported = Column(Boolean, nullable=False, default=False, server_default=false())
    effective_from = Column(Date, nullable=False)
    scheduled_from = Column(Date, nullable=True)
    supersedes_id = Column(
        UUID(as_uuid=True), ForeignKey("weekly_care_needs.id"), nullable=True
    )
    created_by = Column(UUID(as_uuid=True), ForeignKey("employments.id"), nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    activated_at = Column(DateTime(timezone=True), nullable=True)
    ends_on = Column(Date, nullable=True)
    care_slots = relationship(
        "CareSlot",
        back_populates="weekly_care_need",
        order_by="CareSlot.day_of_week, CareSlot.start_time",
    )


class CareSlot(Base):
    """A recurring day/time/service requirement belonging to one immutable version."""

    __tablename__ = "care_slots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    weekly_care_need_id = Column(
        UUID(as_uuid=True),
        ForeignKey("weekly_care_needs.id"),
        nullable=False,
        index=True,
    )
    client_id = Column(
        UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False
    )
    day_of_week = Column(Enum(WeekDay), nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    service_type = Column(Enum(ServiceType), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    client = relationship(
        "Client", foreign_keys=[client_id], back_populates="care_slots"
    )
    weekly_care_need = relationship("WeeklyCareNeed", back_populates="care_slots")
