from datetime import time
from uuid import UUID
from pydantic import BaseModel, model_validator
from app.core.enums import WeekDay, ServiceType


class CareScheduleBlockInput(BaseModel):
    day_of_week:  WeekDay
    start_time:   time
    end_time:     time
    service_type: ServiceType

    @model_validator(mode="after")
    def _end_after_start(self):
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class CareScheduleBlockResponse(BaseModel):
    id:           UUID
    day_of_week:  WeekDay
    start_time:   time
    end_time:     time
    service_type: ServiceType

    model_config = {"from_attributes": True}


class CareSchedulePutSchema(BaseModel):
    blocks: list[CareScheduleBlockInput]
