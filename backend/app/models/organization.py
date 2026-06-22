from sqlalchemy import Column, String, DateTime, Boolean, false
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base
import uuid

class Organization(Base):
    __tablename__ = "organizations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    owner_id = Column(UUID(as_uuid=True), nullable=False)
    is_active = Column(Boolean, default=True)

    # Whether this agency operates under funder authorizations (regulated care).
    # When False the app is a plain scheduler — authorization UI stays hidden.
    uses_authorizations = Column(Boolean, nullable=False, default=False, server_default=false())

    # Legal identity
    legal_name      = Column(String, nullable=True)
    business_number = Column(String, nullable=True)

    # Business address
    street      = Column(String, nullable=True)
    city        = Column(String, nullable=True)
    province    = Column(String, nullable=True)
    postal_code = Column(String, nullable=True)

    deleted_at = Column(DateTime(timezone=True), nullable=True)

    terms_accepted_at = Column(DateTime(timezone=True), nullable=True)
    terms_accepted_version = Column(String, nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    stripe_customer_id = Column(String, nullable=True)
    subscription_id = Column(String, nullable=True)
    subscription_status = Column(String, nullable=True)
    subscription_current_period_end = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    employments = relationship("Employment", back_populates="organization")
    clients = relationship("Client", back_populates="organization")
