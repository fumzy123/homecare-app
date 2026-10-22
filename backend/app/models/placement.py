import uuid
from sqlalchemy import Column, String, Text, Date, DateTime, ForeignKey, Enum, UniqueConstraint, Index, CheckConstraint, text
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
    # generated on fill. List of {day_of_week, start_time, end_time}.
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
    __table_args__ = (
        Index('uq_care_slot_open_assignment', 'care_slot_id', unique=True,
              postgresql_where=text('ends_before IS NULL'), sqlite_where=text('ends_before IS NULL')),
        CheckConstraint('ends_before IS NULL OR ends_before >= starts_on', name='ck_assignment_dates'),
        CheckConstraint("assignment_source IN ('worker_interest', 'admin_arranged')", name='ck_assignment_source'),
    )
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    care_slot_id = Column(UUID(as_uuid=True), ForeignKey('care_slots.id'), nullable=False, index=True)
    placement_id = Column(UUID(as_uuid=True), ForeignKey('placements.id'), nullable=False, index=True)
    employment_id = Column(UUID(as_uuid=True), ForeignKey('employments.id'), nullable=False)
    approved_by = Column(UUID(as_uuid=True), ForeignKey('employments.id'), nullable=False)
    assignment_source = Column(String, nullable=False, default='worker_interest', server_default='worker_interest')
    starts_on = Column(Date, nullable=False)
    # Exclusive boundary: no visits from this agency-local date onward.
    ends_before = Column(Date, nullable=True)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    ended_by = Column(UUID(as_uuid=True), ForeignKey('employments.id'), nullable=True)
    end_reason = Column(Text, nullable=True)
    approved_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    employment = relationship('Employment', foreign_keys=[employment_id])
    care_slot = relationship('CareSlot')
    placement = relationship('Placement')
