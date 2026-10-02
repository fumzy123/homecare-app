from datetime import date, datetime
from uuid import UUID
from typing import Literal
from pydantic import BaseModel, Field
from app.schemas.attention import AttentionTarget


class ActivityEntry(BaseModel):
    id: str
    situation_key: str
    category: str
    kind: Literal["completed", "update"]
    title: str
    detail: str
    actor: str | None = None
    mine: bool = False
    created_at: datetime
    unread: bool = False
    target: AttentionTarget | None = None


class ActivityPage(BaseModel):
    entries: list[ActivityEntry]
    next_cursor: str | None = None
    today: date
    timezone: str


class ReadActivity(BaseModel):
    event_ids: list[UUID] = Field(default_factory=list, max_length=100)
    notification_ids: list[UUID] = Field(default_factory=list, max_length=100)
