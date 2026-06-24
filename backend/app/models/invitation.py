from sqlalchemy import Column, String, Enum, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.models.base import Base
from app.core.enums import OrgMemberRole, EmploymentType
import uuid


class Invitation(Base):
    __tablename__ = "invitations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, nullable=False)
    role = Column(Enum(OrgMemberRole), nullable=False)
    employment_type = Column(Enum(EmploymentType), nullable=True)

    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    invited_by = Column(UUID(as_uuid=True), ForeignKey("employments.id"), nullable=False)

    # Supabase auth user ID created by invite_user_by_email
    supabase_user_id = Column(UUID(as_uuid=True), nullable=True)

    invited_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
