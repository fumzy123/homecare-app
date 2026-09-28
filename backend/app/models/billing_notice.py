from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base


class BillingNotice(Base):
    """Retain deduplication even after old notifications are purged."""
    __tablename__ = "billing_notices"
    key = Column(String, primary_key=True)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    notification_id = Column(UUID(as_uuid=True), ForeignKey("notifications.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), nullable=False)
