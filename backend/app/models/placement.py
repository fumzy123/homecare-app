import uuid
from sqlalchemy import Column, String, Text, Date, DateTime, ForeignKey, Enum, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base
from app.core.enums import PlacementStatus


class Placement(Base):
    __tablename__ = "placements"

    id                = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id            = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    client_id         = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    weekly_care_need_id = Column(UUID(as_uuid=True), ForeignKey('weekly_care_needs.id'), nullable=True, unique=True)
    weekly_care_need = relationship('WeeklyCareNeed')
    created_by        = Column(UUID(as_uuid=True), ForeignKey("employments.id"), nullable=False)
    shift_description = Column(Text, nullable=False)
    requirements      = Column(Text, nullable=True)
    masked_location   = Column(String, nullable=False)
    # When the placement's care begins — advertised to workers and the base for
    # shift generation on fill. Nullable for placements posted before this field.
    start_date        = Column(Date, nullable=True)
    # Structured weekly care need frozen at post time — the schedule that gets
    # generated on fill. List of {day_of_week, start_time, end_time, service_type}.
    care_slot_snapshot = Column(JSONB, nullable=True)
    status            = Column(Enum(PlacementStatus), nullable=False, default=PlacementStatus.open)
    filled_by         = Column(UUID(as_uuid=True), ForeignKey("employments.id"), nullable=True)
    resolved_at       = Column(DateTime(timezone=True), nullable=True)
    created_at        = Column(DateTime(timezone=True), server_default=func.now())

    client    = relationship("Client", foreign_keys=[client_id])
    creator   = relationship("Employment", foreign_keys=[created_by])
    filler    = relationship("Employment", foreign_keys=[filled_by])
    interests = relationship("PlacementInterest", back_populates="placement",
                             cascade="all, delete-orphan")


class PlacementInterest(Base):
    __tablename__ = "placement_interests"
    __table_args__ = (
        UniqueConstraint("placement_id", "employment_id", name="uq_placement_interest"),
    )

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    placement_id  = Column(UUID(as_uuid=True), ForeignKey("placements.id", ondelete="CASCADE"),
                           nullable=False)
    employment_id = Column(UUID(as_uuid=True), ForeignKey("employments.id"), nullable=False)
    note          = Column(Text, nullable=True)
    care_slot_ids = Column(JSONB, nullable=False, default=list)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    placement  = relationship("Placement", back_populates="interests")
    employment = relationship("Employment", foreign_keys=[employment_id])


class CareSlotAssignment(Base):
    __tablename__ = 'care_slot_assignments'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    care_slot_id = Column(UUID(as_uuid=True), ForeignKey('care_slots.id'), nullable=False, unique=True)
    placement_id = Column(UUID(as_uuid=True), ForeignKey('placements.id'), nullable=False, index=True)
    employment_id = Column(UUID(as_uuid=True), ForeignKey('employments.id'), nullable=False)
    approved_by = Column(UUID(as_uuid=True), ForeignKey('employments.id'), nullable=False)
    starts_on = Column(Date, nullable=False)
    approved_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    employment = relationship('Employment', foreign_keys=[employment_id])
    care_slot = relationship('CareSlot')
