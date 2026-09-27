"""Immutable announced terms, separate from the owner's original consent."""
import uuid
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base


class FoundingConversion(Base):
    __tablename__ = "founding_conversions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), unique=True, nullable=False)
    subscription_id = Column(String, nullable=False)
    target_price_id = Column(String, nullable=False)
    target_plan_version = Column(Integer, nullable=False)
    base_amount_cents = Column(Integer, nullable=False)
    additional_client_amount_cents = Column(Integer, nullable=False)
    included_clients = Column(Integer, nullable=False)
    notice_at = Column(DateTime(timezone=True), nullable=False)
    effective_at = Column(DateTime(timezone=True), nullable=False)
    status = Column(String, nullable=False, default="pending")
    schedule_id = Column(String, nullable=True)
    attempted_at = Column(DateTime(timezone=True), nullable=True)
    converted_at = Column(DateTime(timezone=True), nullable=True)
