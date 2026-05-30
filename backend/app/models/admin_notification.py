import uuid
from sqlalchemy import Column, Boolean, DateTime, ForeignKey, Enum, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base
from app.core.enums import NotificationType


class AdminNotification(Base):
    __tablename__ = "admin_notifications"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id       = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    type         = Column(Enum(NotificationType), nullable=False)
    worker_id    = Column(UUID(as_uuid=True), ForeignKey("org_members.id"), nullable=False)
    payload      = Column(JSONB, nullable=False, default=dict)
    requires_action = Column(Boolean, nullable=False, default=False)
    resolved_at  = Column(DateTime(timezone=True), nullable=True)
    resolved_by  = Column(UUID(as_uuid=True), ForeignKey("org_members.id"), nullable=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    worker       = relationship("OrgMember", foreign_keys=[worker_id])
    resolver     = relationship("OrgMember", foreign_keys=[resolved_by])
    reads        = relationship("AdminNotificationRead", back_populates="notification",
                                cascade="all, delete-orphan")


class AdminNotificationRead(Base):
    """One row per (notification, admin). NULL read_at = unread."""
    __tablename__ = "admin_notification_reads"
    __table_args__ = (
        UniqueConstraint("notification_id", "admin_id", name="uq_notification_read"),
    )

    notification_id = Column(UUID(as_uuid=True), ForeignKey("admin_notifications.id",
                             ondelete="CASCADE"), nullable=False, primary_key=True)
    admin_id        = Column(UUID(as_uuid=True), ForeignKey("org_members.id"),
                             nullable=False, primary_key=True)
    read_at         = Column(DateTime(timezone=True), nullable=True)

    notification    = relationship("AdminNotification", back_populates="reads")
    admin           = relationship("OrgMember", foreign_keys=[admin_id])
