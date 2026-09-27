"""Durable activation request; not proof of Stripe trial creation or consent."""
import uuid

from sqlalchemy import Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base


class TrialActivation(Base):
    __tablename__ = "trial_activations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, unique=True)
    requested_at = Column(DateTime(timezone=True), nullable=False)
    requested_by = Column(UUID(as_uuid=True), nullable=True)  # Auth user ID; null for backstop
    source = Column(String, nullable=False)  # operator or backstop
    starts_at = Column(DateTime(timezone=True), nullable=False)
    ends_at = Column(DateTime(timezone=True), nullable=False)
    status = Column(String, nullable=False, default="pending")
    stripe_attempted_at = Column(DateTime(timezone=True), nullable=True)
