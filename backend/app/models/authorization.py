import uuid
from sqlalchemy import Column, String, Text, Date, DateTime, Numeric, ForeignKey, Enum, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base
from app.core.enums import HoursPeriod, ServiceType


class Authorization(Base):
    """A funder document authorising the agency to provide (and bill for) care
    for a client. One header → many service line items. Status is derived, never
    stored — only `cancelled_at` (early revocation) and the supersede chain are
    persisted."""
    __tablename__ = "authorizations"

    id                   = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id               = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    client_id            = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)

    # Funder identity (printed on the document)
    funder               = Column(String, nullable=False)
    funder_file_number   = Column(String, nullable=True)
    authorization_number = Column(String, nullable=False)

    # The authorisation window
    covering_start       = Column(Date, nullable=False)
    covering_end         = Column(Date, nullable=True)
    date_issued          = Column(Date, nullable=True)
    authorized_by        = Column(String, nullable=True)
    hours_period         = Column(Enum(HoursPeriod), nullable=False, default=HoursPeriod.bi_weekly)

    # Billing
    client_monthly_contribution_amount = Column(Numeric(10, 2), nullable=True)
    invoice_to           = Column(Text, nullable=True)

    # Lifecycle (the only stored state — everything else is derived)
    cancelled_at         = Column(DateTime(timezone=True), nullable=True)
    supersedes_id        = Column(UUID(as_uuid=True), ForeignKey("authorizations.id"), nullable=True)

    notes                = Column(Text, nullable=True)
    created_by           = Column(UUID(as_uuid=True), ForeignKey("employments.id"), nullable=True)
    created_at           = Column(DateTime(timezone=True), server_default=func.now())
    updated_at           = Column(DateTime(timezone=True), onupdate=func.now())

    client     = relationship("Client", foreign_keys=[client_id], back_populates="authorizations")
    creator    = relationship("Employment", foreign_keys=[created_by])
    supersedes = relationship("Authorization", remote_side=[id], foreign_keys=[supersedes_id])
    services   = relationship("AuthorizationService", back_populates="authorization",
                              cascade="all, delete-orphan")


class AuthorizationService(Base):
    """A single service line on an authorization (e.g. personal_care: 21h).
    Hours are interpreted against the parent's `hours_period`."""
    __tablename__ = "authorization_services"
    __table_args__ = (
        UniqueConstraint("authorization_id", "service_type", name="uq_authorization_service"),
    )

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    authorization_id = Column(UUID(as_uuid=True), ForeignKey("authorizations.id", ondelete="CASCADE"),
                              nullable=False)
    service_type     = Column(Enum(ServiceType), nullable=False)
    authorized_hours = Column(Numeric(6, 2), nullable=False)

    authorization = relationship("Authorization", back_populates="services")
