import uuid
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint, CheckConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.models.base import Base


class BillingPeriod(Base):
    __tablename__ = "billing_periods"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    subscription_id = Column(String, nullable=False)
    source_invoice_id = Column(String, nullable=True)
    source_invoice_line_id = Column(String, nullable=True)
    starts_at = Column(DateTime(timezone=True), nullable=False)
    ends_at = Column(DateTime(timezone=True), nullable=False)
    anchor_at = Column(DateTime(timezone=True), nullable=False)
    agency_timezone = Column(String, nullable=False)
    plan_code = Column(String, nullable=False)
    plan_version = Column(Integer, nullable=False)
    base_interval = Column(String, nullable=False)
    included_clients = Column(Integer, nullable=False)
    additional_client_amount_cents = Column(Integer, nullable=False)
    currency = Column(String, nullable=False)
    finalization_eligible_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    __table_args__ = (
        Index("ix_billing_period_finalization_due", "finalization_eligible_at", "id"),
        UniqueConstraint("org_id", "subscription_id", "starts_at", name="uq_billing_period_org_subscription_start"),
        CheckConstraint("ends_at > starts_at", name="ck_billing_period_order"),
        CheckConstraint("included_clients >= 0 AND additional_client_amount_cents >= 0", name="ck_billing_period_rates"),
    )
