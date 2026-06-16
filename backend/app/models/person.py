import uuid
from sqlalchemy import Column, String, Date, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base


class Person(Base):
    __tablename__ = "persons"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    supabase_user_id = Column(UUID(as_uuid=True), unique=True, nullable=True)

    # Permanent identity
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    phone_number = Column(String, nullable=True)
    gender = Column(String, nullable=True)
    date_of_birth = Column(Date, nullable=True)

    # Address
    street = Column(String, nullable=True)
    city = Column(String, nullable=True)
    province = Column(String, nullable=True)
    postal_code = Column(String, nullable=True)

    # Scheduling & preferences
    # NOTE: availability is now modelled as interval rows in
    # worker_availability_blocks (see Person.availability_blocks), not a JSON grid.
    languages = Column(JSONB, nullable=True)
    pet_tolerance = Column(String, nullable=True)
    preferred_client_types = Column(JSONB, nullable=True)

    # Emergency contact
    emergency_contact_name = Column(String, nullable=True)
    emergency_contact_phone = Column(String, nullable=True)
    emergency_contact_relationship = Column(String, nullable=True)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    employments = relationship("Employment", back_populates="person")
    credentials = relationship("Credential", back_populates="person", foreign_keys="[Credential.person_id]")
    availability_blocks = relationship(
        "WorkerAvailabilityBlock", back_populates="person",
        foreign_keys="WorkerAvailabilityBlock.person_id", cascade="all, delete-orphan",
    )
