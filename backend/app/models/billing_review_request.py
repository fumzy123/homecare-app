"""Agency billing questions and the operator's recorded response."""
import uuid
from sqlalchemy import Column, DateTime, ForeignKey, String, Text, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base


class BillingReviewRequest(Base):
    __tablename__ = "billing_review_requests"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    period_id = Column(UUID(as_uuid=True), ForeignKey("billing_periods.id"), nullable=False)
    request_id = Column(UUID(as_uuid=True), nullable=False)
    submitted_by = Column(UUID(as_uuid=True), nullable=False)
    submitted_at = Column(DateTime(timezone=True), nullable=False)
    message = Column(Text, nullable=False)
    status = Column(String, nullable=False, default="open")
    response = Column(Text, nullable=True)
    resolved_by = Column(UUID(as_uuid=True), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    __table_args__ = (
        UniqueConstraint("org_id", "request_id", name="uq_billing_review_request"),
        Index("ix_billing_review_queue", "status", "submitted_at", "id"),
        Index("ix_billing_review_period", "org_id", "period_id", "submitted_at"),
    )
