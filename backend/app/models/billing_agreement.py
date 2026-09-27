"""Owner's versioned authorization for a future subscription."""
import uuid
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base


class BillingAgreement(Base):
    __tablename__ = "billing_agreements"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, unique=True)
    plan_code = Column(String, nullable=False)
    plan_version = Column(Integer, nullable=False)
    base_interval = Column(String, nullable=False)
    stripe_price_id = Column(String, nullable=False)
    consent_version = Column(String, nullable=False)
    accepted_at = Column(DateTime(timezone=True), nullable=False)
    accepted_by = Column(UUID(as_uuid=True), nullable=False)
    customer_attempted_at = Column(DateTime(timezone=True), nullable=True)
    checkout_session_id = Column(String, nullable=True)
    payment_method_id = Column(String, nullable=True)
    canceled_at = Column(DateTime(timezone=True), nullable=True)

