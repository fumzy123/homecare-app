from sqlalchemy import Column, String, Enum, DateTime, Date, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base
from app.core.enums import ComplianceDocumentType
import uuid


class Credential(Base):
    __tablename__ = "credentials"
    __table_args__ = (
        UniqueConstraint("person_id", "document_type", name="uq_credential_person_type"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    person_id = Column(UUID(as_uuid=True), ForeignKey("persons.id"), nullable=False)

    document_type = Column(Enum(ComplianceDocumentType), nullable=False)
    expiry_date = Column(Date, nullable=True)
    file_url = Column(String, nullable=True)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    verified_at = Column(DateTime(timezone=True), nullable=True)
    verified_by = Column(UUID(as_uuid=True), ForeignKey("employments.id"), nullable=True)

    person = relationship("Person", back_populates="credentials", foreign_keys=[person_id])
