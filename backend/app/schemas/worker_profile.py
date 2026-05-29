from pydantic import BaseModel
from datetime import date
from uuid import UUID
from typing import Optional
from app.core.enums import OrgMemberRole


class WorkerProfileResponse(BaseModel):
    id:                  UUID
    first_name:          str
    last_name:           str
    email:               str
    phone_number:        Optional[str]
    role:                OrgMemberRole
    hire_date:           Optional[date]
    max_hours_per_week:  Optional[int]
    model_config = {"from_attributes": True}


class WorkerStatsResponse(BaseModel):
    hours_this_week:    float
    weekly_hour_cap:    Optional[int]
    punctuality_streak: Optional[int]
    care_log_streak:    Optional[int]
