from pydantic import BaseModel, model_validator
from datetime import time
from uuid import UUID
from app.core.enums import WeekDay


class AvailabilityEntryInput(BaseModel):
    day_of_week: WeekDay
    start_time: time
    end_time: time

    @model_validator(mode="after")
    def end_after_start(self):
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class AvailabilityEntryResponse(BaseModel):
    id: UUID
    day_of_week: WeekDay
    start_time: time
    end_time: time

    model_config = {"from_attributes": True}


class AvailabilityPutSchema(BaseModel):
    entries: list[AvailabilityEntryInput]

    @model_validator(mode="after")
    def no_overlaps(self):
        by_day: dict[WeekDay, list[AvailabilityEntryInput]] = {}
        for e in self.entries:
            by_day.setdefault(e.day_of_week, []).append(e)
        for day_entries in by_day.values():
            ordered = sorted(day_entries, key=lambda e: e.start_time)
            for prev, nxt in zip(ordered, ordered[1:]):
                if nxt.start_time < prev.end_time:
                    raise ValueError("availability windows on the same day must not overlap")
        return self
