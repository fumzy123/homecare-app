"""Agency accomplishments. Business services write these in their own transaction."""

import uuid
from sqlalchemy import Column, DateTime, ForeignKey, String, Text, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.models.base import Base


class ActivityEvent(Base):
    __tablename__ = "activity_events"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    actor_id = Column(UUID(as_uuid=True), ForeignKey("employments.id"), nullable=True)
    situation_key = Column(String(200), nullable=False)
    category = Column(String(40), nullable=False)
    title = Column(Text, nullable=False)
    detail = Column(Text, nullable=False, default="")
    target = Column(JSONB, nullable=False, default=dict)
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    __table_args__ = (
        Index("ix_activity_org_time", "org_id", "created_at", "id"),
        Index("ix_activity_situation", "org_id", "situation_key", "created_at"),
        Index("ix_activity_actor", "org_id", "actor_id", "created_at"),
    )


class ActivityRead(Base):
    __tablename__ = "activity_reads"
    event_id = Column(
        UUID(as_uuid=True),
        ForeignKey("activity_events.id", ondelete="CASCADE"),
        primary_key=True,
    )
    member_id = Column(
        UUID(as_uuid=True), ForeignKey("employments.id"), primary_key=True
    )
    read_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class OvertimeRequest(Base):
    __tablename__ = "overtime_requests"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True
    )
    notification_id = Column(
        UUID(as_uuid=True),
        ForeignKey("notifications.id", ondelete="SET NULL"),
        unique=True,
    )
    requested_by = Column(UUID(as_uuid=True), ForeignKey("employments.id"))
    worker_id = Column(UUID(as_uuid=True), ForeignKey("employments.id"), nullable=False)
    details = Column(JSONB, nullable=False)
    status = Column(String(30), nullable=False, default="pending")
    decided_by = Column(UUID(as_uuid=True), ForeignKey("employments.id"))
    decided_at = Column(DateTime(timezone=True))
    decision_note = Column(Text)
    shift_id = Column(UUID(as_uuid=True), ForeignKey("shifts.id"))
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
