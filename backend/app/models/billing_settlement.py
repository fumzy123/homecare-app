"""Durable Stripe operations; one immutable source per usage/adjustment charge."""
import uuid
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, JSON, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base


class BillingSettlement(Base):
    __tablename__ = "billing_settlements"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_key = Column(String, nullable=False, unique=True)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    period_id = Column(UUID(as_uuid=True), ForeignKey("billing_usage_snapshots.period_id"), nullable=False)
    adjustment_id = Column(UUID(as_uuid=True), ForeignKey("billing_adjustments.id"), nullable=True, unique=True)
    amount_cents = Column(Integer, nullable=False)
    currency = Column(String, nullable=False)
    state = Column(String, nullable=False)
    payment_status = Column(String, nullable=True)
    invoice_id = Column(String, nullable=True)
    invoice_line_id = Column(String, nullable=True)
    context = Column(JSON, nullable=False)
    steps = Column(JSON, nullable=False)
    lease_token = Column(UUID(as_uuid=True), nullable=True)
    lease_until = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=False)
    error_code = Column(String, nullable=True)
    __table_args__ = (Index("ix_billing_settlement_work", "state", "updated_at"),
                     Index("ix_billing_settlement_org_period", "org_id", "period_id"))


class BillingInvoiceHold(Base):
    __tablename__ = "billing_invoice_holds"
    invoice_id = Column(String, primary_key=True)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    subscription_id = Column(String, nullable=False)
    usage_starts_at = Column(DateTime(timezone=True), nullable=False)
    usage_ends_at = Column(DateTime(timezone=True), nullable=False)
    state = Column(String, nullable=False)
    base_line_id = Column(String, nullable=False)
    base_amount_cents = Column(Integer, nullable=False)
    __table_args__ = (UniqueConstraint("org_id", "subscription_id", "usage_starts_at", name="uq_billing_invoice_hold_period"),)
