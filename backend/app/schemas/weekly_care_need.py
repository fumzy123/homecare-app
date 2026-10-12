from datetime import time, date, datetime
from uuid import UUID
from pydantic import BaseModel, Field, model_validator
from app.core.enums import WeekDay, ServiceType


class CareSlotInput(BaseModel):
    day_of_week: WeekDay
    start_time: time
    end_time: time
    service_type: ServiceType

    @model_validator(mode="after")
    def validate_times(self):
        if (
            self.start_time.tzinfo
            or self.end_time.tzinfo
            or self.end_time <= self.start_time
        ):
            raise ValueError("Care Slot end must be after start, using local times")
        return self


class CareSlotResponse(CareSlotInput):
    id: UUID
    model_config = {"from_attributes": True}


class WeeklyCareNeedCreate(BaseModel):
    effective_from: date
    care_slots: list[CareSlotInput] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def no_overlapping_slots(self):
        for i, slot in enumerate(self.care_slots):
            if any(
                slot.day_of_week == other.day_of_week
                and slot.start_time < other.end_time
                and other.start_time < slot.end_time
                for other in self.care_slots[:i]
            ):
                raise ValueError("Care Slots cannot overlap on the same day")
        return self


class WeeklyCareNeedResponse(BaseModel):
    id: UUID
    client_id: UUID
    version: int
    imported: bool
    effective_from: date
    created_at: datetime
    scheduled_from: date | None
    activated_at: datetime | None
    ends_on: date | None
    supersedes_id: UUID | None
    care_slots: list[CareSlotResponse]
    model_config = {"from_attributes": True}
