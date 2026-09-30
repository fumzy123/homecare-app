from typing import Literal
from uuid import UUID
from pydantic import BaseModel
from app.core.enums import OrgMemberRole


class WorkerAccountResponse(BaseModel):
    status: Literal["active", "pending", "expired", "no_access"]
    email: str
    first_name: str | None = None
    org_name: str | None = None
    org_id: UUID | None = None
    employment_id: UUID | None = None
    role: OrgMemberRole | None = None
