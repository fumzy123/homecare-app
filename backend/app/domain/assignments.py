"""Recurring assignment boundaries. No database access or transaction ownership."""
from datetime import datetime, time, timedelta, timezone
from app.core.enums import ShiftCompletionStatus, ShiftStatus
from app.core.exceptions import AppError
from app.domain.scheduling import expand_occurrences


def open_assignments(assignments):
    """Assignments without an explicit ending; ended rows remain as history."""
    return [a for a in assignments if getattr(a, 'ends_before', None) is None]


def replacement_from(assignments, slot_id):
    boundaries = [a.ends_before for a in assignments
                  if a.care_slot_id == slot_id and getattr(a, 'ends_before', None)]
    return max(boundaries) if boundaries else None


def validate_cutoff(shifts, notes, stops_from, now):
    """Do not hide an elapsed, ongoing or documented occurrence by truncating its series."""
    boundary = datetime.combine(stops_from, time.min)
    for note in notes:
        shift = next(s for s in shifts if s.id == note.shift_id)
        mod = next((m for m in shift.modifications if m.original_date == note.occurrence_date), None)
        moved_after = mod and mod.new_start_time and mod.new_start_time >= boundary
        if note.occurrence_date >= stops_from or moved_after:
            raise AppError(409, 'DOCUMENTED_VISIT_AT_CUTOFF',
                           'A selected visit already has a progress note. Choose a later stop date to preserve it.')
    for shift in shifts:
        mods = {m.original_date: m for m in shift.modifications}
        # Only the cutoff day can contain elapsed unmodified visits, as backdating is rejected.
        days = set(expand_occurrences(shift, stops_from, now.date())) if stops_from <= now.date() else set()
        days.update(mods)
        for day in days:
            mod = mods.get(day)
            start = (mod.new_start_time if mod else None) or datetime.combine(day, shift.start_time.time())
            end = (mod.new_end_time if mod else None) or start + (shift.end_time - shift.start_time)
            affected = day >= stops_from or start >= boundary or end > boundary
            if not affected:
                continue
            recorded = mod and mod.completion_status in (ShiftCompletionStatus.in_progress, ShiftCompletionStatus.completed)
            if start < now or recorded:
                raise AppError(409, 'RECORDED_VISIT_AT_CUTOFF',
                               'This cutoff would affect a past, ongoing or completed visit. Choose a later stop date.')
        # An overnight occurrence may start before the cutoff and still be underway.
        previous = stops_from - timedelta(days=1)
        for day in expand_occurrences(shift, previous, previous):
            mod = mods.get(day)
            start = (mod.new_start_time if mod else None) or datetime.combine(day, shift.start_time.time())
            end = (mod.new_end_time if mod else None) or start + (shift.end_time - shift.start_time)
            if start < boundary < end:
                raise AppError(409, 'VISIT_CROSSES_CUTOFF',
                               'A visit runs overnight across this stop date. Choose the following day.')


def stop_scheduled_visits(shifts, stops_from):
    boundary = datetime.combine(stops_from, time.min)
    for shift in shifts:
        for mod in shift.modifications:
            actual_start = mod.new_start_time or datetime.combine(mod.original_date, shift.start_time.time())
            if actual_start >= boundary and mod.completion_status not in (ShiftCompletionStatus.cancelled, ShiftCompletionStatus.dropped):
                mod.completion_status = ShiftCompletionStatus.cancelled
                mod.cancelled_at = datetime.now(timezone.utc)
                mod.cancellation_reason = 'Recurring assignment ended'
        if shift.is_recurring:
            end = stops_from - timedelta(days=1)
            shift.recurrence_end_date = min(shift.recurrence_end_date or end, end)
        elif shift.start_time >= boundary:
            shift.status = ShiftStatus.cancelled
            shift.cancellation_reason = 'Recurring assignment ended'
