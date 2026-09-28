"""Verified Stripe event receipts. Raw Stripe payloads are deliberately not stored."""
from sqlalchemy import Column, String, DateTime, Boolean, Integer, Index
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base


class BillingWebhook(Base):
    __tablename__ = "billing_webhooks"
    event_id = Column(String, primary_key=True)
    event_type = Column(String, nullable=False)
    object_id = Column(String, nullable=False)
    customer_id = Column(String, nullable=False)
    livemode = Column(Boolean, nullable=False)
    state = Column(String, nullable=False)
    attempts = Column(Integer, nullable=False, default=0)
    received_at = Column(DateTime(timezone=True), nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=False)
    completed_at = Column(DateTime(timezone=True))
    next_attempt_at = Column(DateTime(timezone=True), nullable=False)
    lease_token = Column(UUID(as_uuid=True))
    lease_until = Column(DateTime(timezone=True))
    error_code = Column(String)
    __table_args__ = (Index("ix_billing_webhook_work", "state", "next_attempt_at"),)
