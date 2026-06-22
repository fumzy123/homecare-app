"""Scheduling domain rules.

Pure business logic about *when* care happens and whether a worker can take it —
free of HTTP, transactions, and identity. The occurrence math is module-level
functions (no I/O); `SchedulingChecker` adds the repository-backed checks
(conflicts, hours/overtime) shared by `ShiftService` and `PlacementService`.

This is the canonical home for the RRULE expansion and the conflict/overtime
rules — they used to live as private methods on `ShiftService`.
"""
from datetime import date, datetime, time, timedelta
from dateutil.rrule import rrulestr
from sqlalchemy.orm import Session
from app.core.enums import ShiftCompletionStatus
from app.models.shift import Shift
from app.repositories.shift_repository import ShiftRepository
from app.repositories.employment_repository import EmploymentRepository


# ── Occurrence math (pure, no I/O) ────────────────────────────────────────────

def expand_occurrences(shift: Shift, from_date: date, to_date: date) -> list[date]:
    """Return all occurrence dates for a shift within the given date range."""
    if not shift.is_recurring:
        shift_date = shift.start_time.date()
        if from_date <= shift_date <= to_date:
            return [shift_date]
        return []

    rule_str = shift.recurrence_rule
    effective_end = shift.recurrence_end_date or to_date
    cap = min(to_date, effective_end)

    rule = rrulestr(rule_str, dtstart=shift.start_time)
    occurrences = rule.between(
        datetime.combine(from_date, time.min),
        datetime.combine(cap, time.max),
        inc=True,
    )
    return [dt.date() for dt in occurrences]


def shift_has_occurrence_on(shift: Shift, target_date: date) -> bool:
    """Does this shift have an occurrence on target_date?"""
    if not shift.is_recurring:
        return shift.start_time.date() == target_date

    end_bound = shift.recurrence_end_date
    if end_bound and target_date > end_bound:
        return False

    rule = rrulestr(shift.recurrence_rule, dtstart=shift.start_time)
    matches = rule.between(
        datetime.combine(target_date, time.min),
        datetime.combine(target_date, time.max),
        inc=True,
    )
    return len(matches) > 0


def timeblock_for_occurrence(
    shift: Shift, target_date: date, shift_mod_map: dict,
) -> tuple[datetime, datetime] | None:
    """Return the (start, end) time block for an occurrence on target_date, or None if cancelled."""
    mod = shift_mod_map.get(target_date)

    if mod and mod.completion_status == ShiftCompletionStatus.cancelled:
        return None

    if mod and mod.new_start_time and mod.new_end_time:
        return (mod.new_start_time, mod.new_end_time)

    duration = shift.end_time - shift.start_time
    start = datetime.combine(target_date, shift.start_time.timetz())
    end = start + duration
    return (start, end)


def times_overlap(start_a: datetime, end_a: datetime, start_b: datetime, end_b: datetime) -> bool:
    """Do two time windows overlap?"""
    return start_a < end_b and end_a > start_b


def iso_week_range(d: date) -> tuple[date, date]:
    """Return the (Sunday, Saturday) calendar week range containing d."""
    sunday = d - timedelta(days=d.isoweekday() % 7)
    saturday = sunday + timedelta(days=6)
    return (sunday, saturday)


# ── Repository-backed checks ──────────────────────────────────────────────────

class SchedulingChecker:
    """Conflict and hours/overtime checks for a worker against proposed time
    blocks. Read-only and transaction-free — constructed with (db, org_id) and
    shared by any service that needs to know whether a worker can be scheduled.
    """

    _OVERTIME_THRESHOLD = 40.0

    def __init__(self, db: Session, org_id):
        self.db = db
        self.org_id = org_id
        self.shift_repo = ShiftRepository(db)
        self.employment_repo = EmploymentRepository(db)

    def find_conflicts(
        self,
        worker_id,
        proposed_time_blocks: list[tuple[date, datetime, datetime]],
        exclude_shift_id=None,
    ) -> list[dict]:
        """Check proposed_time_blocks against all existing shifts for the worker. Returns conflicts."""
        if not proposed_time_blocks:
            return []

        existing_shifts = self.shift_repo.get_active_shifts_for_conflict_check(worker_id, self.org_id)

        if exclude_shift_id:
            existing_shifts = [s for s in existing_shifts if str(s.id) != str(exclude_shift_id)]

        conflicts = []
        for existing_shift in existing_shifts:
            shift_mod_map = {m.original_date: m for m in existing_shift.modifications}

            for target_date, proposed_start, proposed_end in proposed_time_blocks:
                if not shift_has_occurrence_on(existing_shift, target_date):
                    continue

                timeblock = timeblock_for_occurrence(existing_shift, target_date, shift_mod_map)
                if timeblock is None:
                    continue

                existing_start, existing_end = timeblock
                if times_overlap(proposed_start, proposed_end, existing_start, existing_end):
                    client = existing_shift.client
                    client_name = f"{client.first_name} {client.last_name}" if client else "Unknown Client"
                    conflicts.append({
                        "date": target_date.isoformat(),
                        "start": existing_start.isoformat(),
                        "end": existing_end.isoformat(),
                        "client_name": client_name,
                        "shift_id": str(existing_shift.id),
                    })

        return conflicts

    def find_hours_violations(
        self,
        worker_id,
        proposed_time_blocks: list[tuple[date, datetime, datetime]],
        exclude_shift_id=None,
    ) -> tuple[list[dict], list[dict]]:
        """Return (overtime_violations, cap_violations) for the proposed blocks.

        overtime_violations — weeks where existing + proposed > 40 h (statutory overtime).
        cap_violations      — weeks where existing + proposed > worker's personal cap,
                              but only when that cap is below 40 h (part-time sub-threshold).

        Returns ([], []) when proposed_time_blocks is empty.
        Overtime is checked regardless of whether a personal cap is set.
        """
        if not proposed_time_blocks:
            return [], []

        worker = self.employment_repo.get_active_by_id_and_org(worker_id, self.org_id)
        cap = worker.max_hours_per_week

        proposed_by_week: dict[tuple[date, date], float] = {}
        for occ_date, start, end in proposed_time_blocks:
            week = iso_week_range(occ_date)
            proposed_by_week[week] = proposed_by_week.get(week, 0.0) + (end - start).total_seconds() / 3600.0

        existing_shifts = self.shift_repo.get_active_shifts_for_conflict_check(worker_id, self.org_id)
        if exclude_shift_id:
            existing_shifts = [s for s in existing_shifts if str(s.id) != str(exclude_shift_id)]

        overtime_violations: list[dict] = []
        cap_violations: list[dict] = []

        for (week_sun, week_sat), proposed_hours in proposed_by_week.items():
            existing_hours = 0.0
            for shift in existing_shifts:
                mod_map = {m.original_date: m for m in shift.modifications}
                for occ_date in expand_occurrences(shift, week_sun, week_sat):
                    timeblock = timeblock_for_occurrence(shift, occ_date, mod_map)
                    if timeblock is None:
                        continue
                    s, e = timeblock
                    existing_hours += (e - s).total_seconds() / 3600.0

            total = existing_hours + proposed_hours
            base = {
                "week_start":     week_sun.isoformat(),
                "week_end":       week_sat.isoformat(),
                "worker_id":      str(worker.id),
                "worker_name":    f"{worker.person.first_name} {worker.person.last_name}",
                "current_hours":  round(existing_hours, 2),
                "proposed_hours": round(proposed_hours, 2),
                "total_hours":    round(total, 2),
            }

            if total > self._OVERTIME_THRESHOLD:
                overtime_violations.append({**base, "overtime_threshold": self._OVERTIME_THRESHOLD})
            elif cap is not None and cap > 0 and cap < self._OVERTIME_THRESHOLD and total > cap:
                cap_violations.append({**base, "max_hours": cap})

        return overtime_violations, cap_violations
