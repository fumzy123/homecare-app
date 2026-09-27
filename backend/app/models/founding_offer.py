from sqlalchemy import Column, DateTime, ForeignKey, Integer, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base


class FoundingSlot(Base):
    __tablename__ = "founding_slots"
    slot_number = Column(Integer, primary_key=True, autoincrement=False)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), unique=True, nullable=True)
    consumed_at = Column(DateTime(timezone=True), nullable=True)
    __table_args__ = (CheckConstraint("slot_number BETWEEN 1 AND 3", name="ck_founding_slot_limit"),)


class FoundingOffer(Base):
    __tablename__ = "founding_offers"
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), primary_key=True)
    slot_number = Column(Integer, ForeignKey("founding_slots.slot_number"), nullable=False)
    reserved_at = Column(DateTime(timezone=True), nullable=False)
    reserved_by = Column(UUID(as_uuid=True), nullable=False)
    released_at = Column(DateTime(timezone=True), nullable=True)
    released_by = Column(UUID(as_uuid=True), nullable=True)
    forfeited_at = Column(DateTime(timezone=True), nullable=True)
    protection_starts_at = Column(DateTime(timezone=True), nullable=True)
    protection_ends_at = Column(DateTime(timezone=True), nullable=True)
