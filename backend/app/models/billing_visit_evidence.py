"""Append-only versions of historical visit facts, independent of overrides."""
import uuid
from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, UniqueConstraint, CheckConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.models.base import Base


class BillingVisitEvidence(Base):
    __tablename__ = "billing_visit_evidence"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    shift_id = Column(UUID(as_uuid=True), ForeignKey("shifts.id"), nullable=False)
    occurrence_date = Column(Date, nullable=False)
    revision = Column(Integer, nullable=False)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    # Overrides can be deleted by a series edit; deliberately not a foreign key.
    modification_id = Column(UUID(as_uuid=True), nullable=True)
    local_start = Column(DateTime(timezone=False), nullable=False)
    completion_status = Column(String, nullable=False)
    source = Column(String, nullable=False)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    __table_args__ = (
        UniqueConstraint("org_id", "shift_id", "occurrence_date", "revision", name="uq_billing_visit_revision"),
        CheckConstraint("revision > 0", name="ck_billing_visit_revision"),
        Index("ix_billing_visit_org_start", "org_id", "local_start"),
    )
