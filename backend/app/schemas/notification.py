from datetime import datetime
from uuid import UUID
from typing import Any
from pydantic import BaseModel
from app.core.enums import NotificationType


class NotificationResponse(BaseModel):
    id: UUID
    type: NotificationType
    worker_id: UUID
    worker_first_name: str
    worker_last_name: str
    payload: dict[str, Any]
    requires_action: bool
    resolved_at: datetime | None
    created_at: datetime
    read_at: datetime | None  # NULL = unread for the requesting admin

    model_config = {"from_attributes": True}


class NotificationListResponse(BaseModel):
    notifications: list[NotificationResponse]
    unread_count: int
    action_needed_count: int
