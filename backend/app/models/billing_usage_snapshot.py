"""One immutable application snapshot per finalized monthly usage period."""
from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, CheckConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base


class BillingUsageSnapshot(Base):
    __tablename__ = "billing_usage_snapshots"
    period_id = Column(UUID(as_uuid=True), ForeignKey("billing_periods.id"), primary_key=True)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    finalized_at = Column(DateTime(timezone=True), nullable=False)
    active_client_count = Column(Integer, nullable=False)
    additional_clients = Column(Integer, nullable=False)
    usage_amount_cents = Column(Integer, nullable=False)
    # Copy facts, not references to mutable scheduling rows or client names.
    payload = Column(JSON, nullable=False)
    __table_args__ = (
        CheckConstraint("active_client_count >= 0 AND additional_clients >= 0 AND usage_amount_cents >= 0",
                        name="ck_usage_snapshot_nonnegative"),
        Index("ix_usage_snapshot_org_finalized", "org_id", "finalized_at"),
    )
