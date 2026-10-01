from datetime import date, datetime
from typing import Literal
from uuid import UUID
from pydantic import BaseModel


class AttentionTarget(BaseModel):
    kind: Literal['placement', 'care_need', 'credential', 'authorization', 'visit', 'weekly_schedule']
    record_id: UUID
    detail_id: UUID | None = None
    document_type: str | None = None
    occurrence_date: date | None = None


class AttentionItem(BaseModel):
    id: str
    category: Literal['coverage', 'credentials', 'authorizations', 'schedule']
    stage: Literal['post_placement', 'review_interest', 'await_interest', 'cover_slots', 'replace_worker', 'renew_credential', 'verify_credential', 'renew_authorization', 'review_schedule']
    urgency: Literal['urgent', 'upcoming', 'review', 'waiting']
    subject: str
    detail: str
    due_on: date | None = None
    target: AttentionTarget


class AttentionResponse(BaseModel):
    org_id: UUID
    checked_at: datetime
    week_start: date
    week_end: date
    items: list[AttentionItem]
