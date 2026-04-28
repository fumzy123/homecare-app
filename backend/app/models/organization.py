from sqlalchemy import Column, String, DateTime, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base
import uuid

class Organization(Base):
    __tablename__ = "organizations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    owner_id = Column(UUID(as_uuid=True), nullable=False)
    is_active = Column(Boolean, default=True)
    terms_accepted_at = Column(DateTime(timezone=True), nullable=True)
    terms_accepted_version = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships — one org has many users, clients, workers
    members = relationship("OrgMember", back_populates="organization")
    clients = relationship("Client", back_populates="organization")
    
    # ⚠️ Temporarily commented out until you actually create the models!
    # workers = relationship("Worker", back_populates="organization")