from datetime import date, datetime
from zoneinfo import ZoneInfo
from app.repositories.organization_repository import OrganizationRepository
from app.repositories.shift_repository import ShiftRepository
from app.domain.staffing import next_qualifying_visit, on_standby
from app.core.enums import ClientStatus, OrgMemberRole

DAY_LABELS = {
    "MO": "Mon",
    "TU": "Tue",
    "WE": "Wed",
    "TH": "Thu",
    "FR": "Fri",
    "SA": "Sat",
    "SU": "Sun",
}


class Workforce:
    """Read-only projection used by roster and client views; no transactions."""

    def __init__(self, db, org_id):
        self.org = OrganizationRepository(db).get_by_id(org_id)
        self.now = datetime.now(
            ZoneInfo(self.org.billing_timezone or "America/St_Johns")
        ).replace(tzinfo=None)
        self.shifts = ShiftRepository(db).get_shifts_in_range(org_id, date.max)

    def worker_statuses(self, workers):
        next_by_worker = {}
        for shift in self.shifts:
            if shift.client.deleted_at or shift.client.status != ClientStatus.active:
                continue
            next_visit = next_qualifying_visit(shift, self.now)
            if next_visit is not None:
                next_by_worker[shift.worker_id] = min(
                    next_visit, next_by_worker.get(shift.worker_id, next_visit)
                )
        return {
            w["id"]: {
                "on_standby": on_standby(
                    w["is_active"] and w["role"] == OrgMemberRole.home_support_worker,
                    next_by_worker.get(w["id"]),
                    self.now,
                ),
                "next_shift_at": next_by_worker.get(w["id"]),
            }
            for w in workers
        }

    def care_teams(self):
        teams = {}
        for shift in self.shifts:
            if (
                shift.worker.deleted_at
                or shift.client.deleted_at
                or shift.client.status != ClientStatus.active
            ):
                continue
            if next_qualifying_visit(shift, self.now) is None:
                continue
            team = teams.setdefault(shift.client_id, {})
            member = team.setdefault(
                shift.worker_id,
                {
                    "id": shift.worker_id,
                    "first_name": shift.worker.person.first_name,
                    "last_name": shift.worker.person.last_name,
                    "coverage": [],
                },
            )
            days = (
                shift.recurrence_rule.split("BYDAY=")[-1].split(";")[0]
                if shift.is_recurring and "BYDAY=" in (shift.recurrence_rule or "")
                else shift.start_time.strftime("%a")
            )
            days = ", ".join(DAY_LABELS.get(day, day) for day in days.split(","))
            coverage = f"{days} {shift.start_time:%H:%M}–{shift.end_time:%H:%M}"
            if shift.recurrence_end_date:
                coverage += f" through {shift.recurrence_end_date}"
            if coverage not in member["coverage"]:
                member["coverage"].append(coverage)
        return {client: list(workers.values()) for client, workers in teams.items()}
