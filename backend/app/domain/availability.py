"""Availability domain rule.

A pure predicate: does a worker's weekly availability cover a client's weekly
care plan? Owned by neither the worker nor the client — it's a relationship
between the two — so it lives here as a free function with no I/O. Callers fetch
the two sets of entries and ask the question.

Both inputs are any objects exposing `day_of_week`, `start_time`, `end_time`
(WorkerAvailabilityEntry and WeeklyCarePlanEntry both qualify).
"""
from dataclasses import dataclass, field
from typing import Any


@dataclass
class AvailabilityMatch:
    covered: bool
    uncovered: list[Any] = field(default_factory=list)  # care-plan entries with no covering window


def availability_covers_care_plan(
    availability_entries: list,
    care_plan_entries: list,
) -> AvailabilityMatch:
    """A care-plan entry is covered when, on the same weekday, the worker has an
    availability window that fully contains the entry's time range. A worker with
    no availability set covers nothing (covered=False)."""
    # Group availability windows by weekday for quick lookup.
    by_day: dict = {}
    for a in availability_entries:
        by_day.setdefault(a.day_of_week, []).append(a)

    uncovered = []
    for entry in care_plan_entries:
        windows = by_day.get(entry.day_of_week, [])
        if not any(w.start_time <= entry.start_time and entry.end_time <= w.end_time for w in windows):
            uncovered.append(entry)

    return AvailabilityMatch(covered=not uncovered, uncovered=uncovered)
