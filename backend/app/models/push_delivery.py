"""Private, transactional delivery queue. Never expose tokens through the API."""
import uuid
from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint, Uuid
from app.models.base import Base


class PushDelivery(Base):
    __tablename__ = 'push_deliveries'
    __table_args__ = (
        UniqueConstraint('notification_id', 'device_id', name='uq_push_delivery_notice_device'),
        Index('ix_push_deliveries_due', 'status', 'next_attempt_at'),
    )

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    notification_id = Column(Uuid, ForeignKey('notifications.id', ondelete='CASCADE'), nullable=False)
    device_id = Column(Uuid, ForeignKey('push_devices.id', ondelete='CASCADE'), nullable=False)
    worker_id = Column(Uuid, ForeignKey('employments.id', ondelete='CASCADE'), nullable=False)
    org_id = Column(Uuid, ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False)
    token = Column(String(256), nullable=True)
    app_id = Column(String(100), nullable=False)
    kind = Column(String(40), nullable=False)
    status = Column(String(24), nullable=False, default='queued')
    attempts = Column(Integer, nullable=False, default=0)
    ticket_id = Column(String(100), nullable=True)
    error_code = Column(String(60), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False)
    next_attempt_at = Column(DateTime(timezone=True), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
