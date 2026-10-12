"""Upcoming scheduled care, independent of employment status and payroll."""

from datetime import timedelta
from dateutil.rrule import rrulestr
from app.domain.scheduling import resolve_effective_occurrence, shift_has_occurrence_on
from app.core.enums import ShiftCompletionStatus


def next_qualifying_visit(shift, now):
    duration = shift.end_time - shift.start_time
    modifications = {m.original_date: m for m in shift.modifications}
    candidates = set(modifications)
    if not shift.is_recurring:
        candidates.add(shift.start_time.date())
    else:
        rule = rrulestr(shift.recurrence_rule, dtstart=shift.start_time)
        occurrence = rule.after(now - duration, inc=True)
        # Each exception can skip at most one occurrence; avoid expanding years.
        for _ in range(len(modifications) + 2):
            if occurrence is None or (
                shift.recurrence_end_date
                and occurrence.date() > shift.recurrence_end_date
            ):
                break
            candidates.add(occurrence.date())
            resolved = resolve_effective_occurrence(
                shift, occurrence.date(), modifications.get(occurrence.date())
            )
            if resolved.end_time > now and resolved.completion_status in (
                ShiftCompletionStatus.scheduled,
                ShiftCompletionStatus.in_progress,
            ):
                break
            occurrence = rule.after(occurrence)
    visits = []
    for day in candidates:
        if not shift_has_occurrence_on(shift, day):
            continue
        if (
            shift.is_recurring
            and shift.recurrence_end_date
            and day > shift.recurrence_end_date
        ):
            continue
        visit = resolve_effective_occurrence(shift, day, modifications.get(day))
        if visit.end_time > now and visit.completion_status in (
            ShiftCompletionStatus.scheduled,
            ShiftCompletionStatus.in_progress,
        ):
            visits.append(visit.start_time)
    return min(visits) if visits else None


def on_standby(is_active, next_visit, now):
    return is_active and (next_visit is None or next_visit > now + timedelta(days=14))
