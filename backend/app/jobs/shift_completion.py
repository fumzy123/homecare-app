from datetime import datetime, time, timedelta, timezone
from app.db.session import SessionLocal
from app.models.shift import Shift
from app.models.shift_modification import ShiftModification
from app.core.enums import ShiftCompletionStatus, ShiftStatus
from app.services.shift_service import ShiftService


# Statuses that the job must never overwrite
_TERMINAL_STATUSES = {
    ShiftCompletionStatus.completed,
    ShiftCompletionStatus.cancelled,
    ShiftCompletionStatus.no_show,
    ShiftCompletionStatus.in_progress,
}

# How far back to look — catches up if the server was down
_LOOKBACK_DAYS = 2


def mark_shifts_completed() -> None:
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        window_start = (now - timedelta(days=_LOOKBACK_DAYS)).date()
        window_end = now.date()

        shifts = (
            db.query(Shift)
            .filter(
                Shift.status == ShiftStatus.active,
                Shift.deleted_at == None,  # noqa: E711
                Shift.end_time < now,
            )
            .all()
        )

        for shift in shifts:
            mod_map = {m.original_date: m for m in shift.modifications}
            occurrences = ShiftService._expand_occurrences(shift, window_start, window_end)

            for occ_date in occurrences:
                # Reconstruct the occurrence end time to confirm it has actually passed
                if mod_map.get(occ_date) and mod_map[occ_date].new_end_time:
                    occ_end = mod_map[occ_date].new_end_time
                else:
                    delta = shift.end_time - shift.start_time
                    occ_start = datetime.combine(occ_date, shift.start_time.timetz())
                    occ_end = occ_start + delta

                if occ_end >= now:
                    continue

                mod = mod_map.get(occ_date)
                if mod and mod.completion_status in _TERMINAL_STATUSES:
                    continue

                if mod:
                    mod.completion_status = ShiftCompletionStatus.completed
                else:
                    db.add(ShiftModification(
                        shift_id=shift.id,
                        original_date=occ_date,
                        completion_status=ShiftCompletionStatus.completed,
                    ))

        db.commit()

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
