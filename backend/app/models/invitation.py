from sqlalchemy import Column, String, Enum, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.models.base import Base
from app.core.enums import OrgMemberRole
import uuid


class Invitation(Base):
    __tablename__ = "invitations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, nullable=False)
    role = Column(Enum(OrgMemberRole), nullable=False)

    # Who sent it and which org it belongs to
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    invited_by = Column(UUID(as_uuid=True), ForeignKey("org_members.id"), nullable=False)

    # Lifecycle timestamps
    invited_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    accepted_at = Column(DateTime(timezone=True), nullable=True)
