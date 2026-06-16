from pydantic import BaseModel, model_validator
from datetime import time
from uuid import UUID
from app.core.enums import WeekDay


class AvailabilityBlockInput(BaseModel):
    day_of_week: WeekDay
    start_time: time
    end_time: time

    @model_validator(mode="after")
    def end_after_start(self):
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class AvailabilityBlockResponse(BaseModel):
    id: UUID
    day_of_week: WeekDay
    start_time: time
    end_time: time

    model_config = {"from_attributes": True}


class AvailabilityPutSchema(BaseModel):
    blocks: list[AvailabilityBlockInput]

    @model_validator(mode="after")
    def no_overlaps(self):
        by_day: dict[WeekDay, list[AvailabilityBlockInput]] = {}
        for b in self.blocks:
            by_day.setdefault(b.day_of_week, []).append(b)
        for day_blocks in by_day.values():
            ordered = sorted(day_blocks, key=lambda b: b.start_time)
            for prev, nxt in zip(ordered, ordered[1:]):
                if nxt.start_time < prev.end_time:
                    raise ValueError("availability windows on the same day must not overlap")
        return self
