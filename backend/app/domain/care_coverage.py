"""Care coverage transitions. Pure mutations inside the caller's transaction."""

from datetime import datetime, time, timedelta, timezone
from app.core.enums import ShiftStatus, ShiftCompletionStatus
from app.core.exceptions import AppError


def end_previous_coverage(shifts, starts_on):
    boundary = datetime.combine(starts_on, time.min)
    for shift in shifts:
        # Do not silently erase an already delivered occurrence at the boundary.
        for mod in shift.modifications:
            actual_start = mod.new_start_time or datetime.combine(
                mod.original_date, shift.start_time.time()
            )
            if (
                actual_start >= boundary or mod.original_date >= starts_on
            ) and mod.completion_status in (
                ShiftCompletionStatus.completed,
                ShiftCompletionStatus.in_progress,
            ):
                raise AppError(
                    409,
                    "RECORDED_VISIT_AT_CUTOFF",
                    "Existing visits are in progress or completed after this cutoff; choose a later start date",
                )
            if actual_start >= boundary:
                mod.completion_status = ShiftCompletionStatus.cancelled
                mod.cancelled_at = datetime.now(timezone.utc)
                mod.cancellation_reason = "Replaced by a new Weekly Care Need"
        if shift.is_recurring:
            end = starts_on - timedelta(days=1)
            if shift.recurrence_end_date is None or shift.recurrence_end_date > end:
                shift.recurrence_end_date = end
        elif shift.start_time >= boundary:
            shift.status = ShiftStatus.cancelled
            shift.cancellation_reason = "Replaced by a new Weekly Care Need"
