from sqlalchemy import Column, String, Enum, Boolean, DateTime, Date, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base
from app.core.enums import CredentialCategory
import uuid


class Credential(Base):
    __tablename__ = "credentials"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    org_member_id = Column(UUID(as_uuid=True), ForeignKey("org_members.id"), nullable=False)

    name = Column(String, nullable=False)
    category = Column(Enum(CredentialCategory), nullable=True)
    issuer = Column(String, nullable=True)
    issue_date = Column(Date, nullable=True)
    expiry_date = Column(Date, nullable=True)
    is_required = Column(Boolean, nullable=False, default=False)
    file_url = Column(String, nullable=True)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    org_member = relationship("OrgMember", back_populates="credentials")
