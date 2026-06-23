from datetime import datetime
from uuid import UUID
from typing import Any
from pydantic import BaseModel
from app.core.enums import NotificationType, TargetAudience


class NotificationResponse(BaseModel):
    id:                      UUID
    type:                    NotificationType
    target_audience:         TargetAudience
    about_worker_id:         UUID | None
    about_worker_first_name: str | None
    about_worker_last_name:  str | None
    about_client_id:         UUID | None
    triggered_by_id:         UUID | None
    payload:                 dict[str, Any]
    requires_action:         bool
    resolved_at:             datetime | None
    created_at:              datetime
    read_at:                 datetime | None  # NULL = unread for the requesting recipient

    model_config = {"from_attributes": True}


class NotificationListResponse(BaseModel):
    notifications:        list[NotificationResponse]
    unread_count:         int
    action_needed_count:  int
