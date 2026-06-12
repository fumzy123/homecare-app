import uuid
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Enum, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base
from app.core.enums import PlacementStatus


class Placement(Base):
    __tablename__ = "placements"

    id                = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id            = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    client_id         = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    created_by        = Column(UUID(as_uuid=True), ForeignKey("employments.id"), nullable=False)
    shift_description = Column(Text, nullable=False)
    requirements      = Column(Text, nullable=True)
    masked_location   = Column(String, nullable=False)
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
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    placement  = relationship("Placement", back_populates="interests")
    employment = relationship("Employment", foreign_keys=[employment_id])
