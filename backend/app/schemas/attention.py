from datetime import date, datetime
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, Field


class AttentionTarget(BaseModel):
    kind: Literal['placement', 'care_need', 'credential', 'authorization', 'visit', 'weekly_schedule', 'worker', 'billing', 'overtime', 'client', 'notes']
    record_id: UUID
    detail_id: UUID | None = None
    document_type: str | None = None
    occurrence_date: date | None = None


class InterestedWorker(BaseModel):
    id: UUID
    name: str
    slots: list[str]
    unread: bool = False


class AttentionItem(BaseModel):
    id: str
    category: Literal['coverage', 'credentials', 'authorizations', 'schedule', 'workers', 'clients', 'documentation', 'billing']
    stage: Literal['post_placement', 'review_interest', 'await_interest', 'cover_slots', 'replace_worker', 'review_dropped_visit', 'renew_credential', 'verify_credential', 'renew_authorization', 'review_schedule', 'review_overtime', 'await_approval', 'review_billing', 'view_update']
    urgency: Literal['urgent', 'upcoming', 'review', 'waiting']
    subject: str
    detail: str
    due_on: date | None = None
    target: AttentionTarget
    unread_count: int = 0
    action_required: bool = True
    notification_ids: list[UUID] = Field(default_factory=list)
    interested_workers: list[InterestedWorker] = Field(default_factory=list)
    covered_slots: int | None = None
    total_slots: int | None = None


class AttentionResponse(BaseModel):
    org_id: UUID
    checked_at: datetime
    week_start: date
    week_end: date
    items: list[AttentionItem]
    unread_count: int = 0
