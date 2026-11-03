"""Leave uses agency-local calendar days and effective visit intervals."""
from datetime import datetime, time, timedelta
from app.core.enums import ShiftCompletionStatus
from app.domain.scheduling import calendar_occurrence_dates, resolve_effective_occurrence


def affected_visits(shifts, start, end, now, documented):
    visits, protected = [], []
    for shift in shifts:
        mods = {m.original_date: m for m in shift.modifications}
        for day in calendar_occurrence_dates(shift, start, end):
            value = resolve_effective_occurrence(shift, day, mods.get(day))
            if value.completion_status in (ShiftCompletionStatus.cancelled, ShiftCompletionStatus.dropped):
                continue
            row = (shift, day, value, mods.get(day))
            if value.start_time < now or value.completion_status != ShiftCompletionStatus.scheduled or (shift.id, day) in documented:
                protected.append(row)
            else:
                visits.append(row)
    return visits, protected


def leave_overlaps(start, end, leave):
    return start < datetime.combine(leave.end_date + timedelta(days=1), time.min) and end > datetime.combine(leave.start_date, time.min)
