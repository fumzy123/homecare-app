import uuid
from sqlalchemy import Column, Boolean, DateTime, ForeignKey, Enum, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base
from app.core.enums import NotificationType, TargetAudience


class Notification(Base):
    __tablename__ = "notifications"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id           = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    type             = Column(Enum(NotificationType), nullable=False)
    target_audience  = Column(Enum(TargetAudience), nullable=False, default=TargetAudience.admins_only)
    # Who/what the notification is about
    about_worker_id  = Column(UUID(as_uuid=True), ForeignKey("employments.id"), nullable=True)
    about_client_id  = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=True)
    # Who triggered it (admin creating placement, worker dropping shift, etc.)
    triggered_by_id  = Column(UUID(as_uuid=True), ForeignKey("employments.id"), nullable=True)
    # For individual-targeted notifications only
    recipient_id     = Column(UUID(as_uuid=True), ForeignKey("employments.id"), nullable=True)
    payload          = Column(JSONB, nullable=False, default=dict)
    requires_action  = Column(Boolean, nullable=False, default=False)
    resolved_at      = Column(DateTime(timezone=True), nullable=True)
    resolved_by      = Column(UUID(as_uuid=True), ForeignKey("employments.id"), nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())

    about_worker  = relationship("Employment", foreign_keys=[about_worker_id])
    triggered_by  = relationship("Employment", foreign_keys=[triggered_by_id])
    recipient     = relationship("Employment", foreign_keys=[recipient_id])
    resolver      = relationship("Employment", foreign_keys=[resolved_by])
    reads         = relationship("NotificationRead", back_populates="notification",
                                 cascade="all, delete-orphan")


class NotificationRead(Base):
    """One row per (notification, recipient). NULL read_at = unread."""
    __tablename__ = "notification_reads"
    __table_args__ = (
        UniqueConstraint("notification_id", "recipient_id", name="uq_notification_read"),
    )

    notification_id = Column(UUID(as_uuid=True), ForeignKey("notifications.id",
                             ondelete="CASCADE"), nullable=False, primary_key=True)
    recipient_id    = Column(UUID(as_uuid=True), ForeignKey("employments.id"),
                             nullable=False, primary_key=True)
    read_at         = Column(DateTime(timezone=True), nullable=True)

    notification    = relationship("Notification", back_populates="reads")
    recipient       = relationship("Employment", foreign_keys=[recipient_id])


# Backwards-compatibility aliases so any stale import of the old names still resolves.
AdminNotification = Notification
AdminNotificationRead = NotificationRead
