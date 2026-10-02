from sqlalchemy import Column, DateTime, ForeignKey, String, Uuid, func
from app.models.base import Base


class PushDevice(Base):
    __tablename__ = "push_devices"

    id = Column(Uuid, primary_key=True)
    secret_hash = Column(String(64), nullable=False)
    worker_id = Column(Uuid, ForeignKey("employments.id", ondelete="CASCADE"), nullable=False, index=True)
    token = Column(String(256), unique=True, nullable=True)
    app_id = Column(String(100), nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
