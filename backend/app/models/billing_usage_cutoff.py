"""Price-independent usage sealed before any late scheduling mutation."""
from sqlalchemy import Column, DateTime, ForeignKey, String, JSON
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base


class BillingUsageCutoff(Base):
    __tablename__ = "billing_usage_cutoffs"
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), primary_key=True)
    subscription_id = Column(String, primary_key=True)
    starts_at = Column(DateTime(timezone=True), primary_key=True)
    ends_at = Column(DateTime(timezone=True), nullable=False)
    deadline_at = Column(DateTime(timezone=True), nullable=False)
    captured_at = Column(DateTime(timezone=True), nullable=False)
    agency_timezone = Column(String, nullable=False)
    state = Column(String, nullable=False)
    reason = Column(String, nullable=True)
    clients = Column(JSON, nullable=True)
