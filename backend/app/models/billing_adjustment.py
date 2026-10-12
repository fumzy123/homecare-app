"""Reviewed usage corrections; the original financial snapshot is never edited."""
import uuid
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, JSON, UniqueConstraint, CheckConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base


class BillingAdjustment(Base):
    __tablename__ = "billing_adjustments"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    period_id = Column(UUID(as_uuid=True), ForeignKey("billing_usage_snapshots.period_id"), nullable=False)
    request_id = Column(UUID(as_uuid=True), nullable=False)
    baseline_sequence = Column(Integer, nullable=False)
    approval_sequence = Column(Integer, nullable=True)
    status = Column(String, nullable=False)
    amount_cents = Column(Integer, nullable=False)
    currency = Column(String, nullable=False)
    reason = Column(String, nullable=False)
    proposed_by = Column(UUID(as_uuid=True), nullable=False)
    proposed_at = Column(DateTime(timezone=True), nullable=False)
    decided_by = Column(UUID(as_uuid=True), nullable=True)
    decided_at = Column(DateTime(timezone=True), nullable=True)
    decision_reason = Column(String, nullable=True)
    # Approved is not applied. Stripe settlement is a separate workflow.
    settlement_status = Column(String, nullable=False, default="not_approved")
    payload = Column(JSON, nullable=False)
    __table_args__ = (
        UniqueConstraint("org_id", "period_id", "request_id", name="uq_billing_adjustment_request"),
        UniqueConstraint("period_id", "approval_sequence", name="uq_billing_adjustment_approval"),
        CheckConstraint("status IN ('pending', 'approved', 'rejected')", name="ck_billing_adjustment_status"),
        CheckConstraint("baseline_sequence >= 0", name="ck_billing_adjustment_baseline"),
        CheckConstraint("(status = 'approved' AND approval_sequence IS NOT NULL AND approval_sequence = baseline_sequence + 1) OR "
                        "(status != 'approved' AND approval_sequence IS NULL)", name="ck_billing_adjustment_sequence"),
        Index("ix_billing_adjustment_org_period", "org_id", "period_id", "proposed_at"),
    )


class BillingAdjustmentEvent(Base):
    __tablename__ = "billing_adjustment_events"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    adjustment_id = Column(UUID(as_uuid=True), ForeignKey("billing_adjustments.id"), nullable=False)
    action = Column(String, nullable=False)
    actor_id = Column(UUID(as_uuid=True), nullable=False)
    reason = Column(String, nullable=False)
    occurred_at = Column(DateTime(timezone=True), nullable=False)
    __table_args__ = (UniqueConstraint("adjustment_id", "action", name="uq_billing_adjustment_event"),)
