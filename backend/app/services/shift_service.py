from datetime import date, datetime, time, timedelta, timezone
import uuid
from dateutil.rrule import rrulestr
from sqlalchemy.orm import Session
from supabase_auth.types import User as SupabaseUser
from app.models.shift import Shift
from app.models.shift_modification import ShiftModification
from app.core.enums import ShiftCompletionStatus, ShiftStatus, RecurrenceFrequency, OVERTIME_APPROVERS
from app.core.exceptions import AppError
from app.schemas.shift import (
    ClientSummary,
    ShiftCancelFromSchema,
    ShiftCancelSchema,
    ShiftEditFromSchema,
    ShiftCreateSchema,
    ShiftModificationCreateSchema,
    ShiftModificationUpdateSchema,
    ShiftOccurrenceResponse,
    ShiftUpdateSchema,
    WorkerSummary,
)
from app.repositories.shift_repository import ShiftRepository, ShiftModificationRepository
from app.repositories.organization_repository import OrganizationRepository
from app.repositories.employment_repository import EmploymentRepository
from app.domain.scheduling import (
    SchedulingChecker,
    expand_occurrences,
    timeblock_for_occurrence,
    iso_week_range,
)


class ShiftService:

    def __init__(self, db: Session, current_user: SupabaseUser):
        self.db = db
        self.current_user = current_user
        self.shift_repo = ShiftRepository(db)
        self.modification_repo = ShiftModificationRepository(db)
        self.employment_repo = EmploymentRepository(db)
        org_repo = OrganizationRepository(db)
        current_employment = org_repo.get_active_employment_for_user(current_user.id)
        if not current_employment:
            raise AppError(status_code=404, code="NOT_FOUND", message="Member record not found")
        self.org_id = current_employment.org_id
        self.current_employment_id = current_employment.id
        self.current_member_role = current_employment.role
        self.current_employment = current_employment
        self.checker = SchedulingChecker(self.db, self.org_id)

    # ─────────────────────────────────────────
    # Internal helpers
    # ─────────────────────────────────────────

    def _get_active_shift(self, shift_id: str) -> Shift:
        return self.shift_repo.get_active_shift(shift_id, self.org_id)

    @staticmethod
    def _build_rrule_string(recurrence) -> str:
        """Convert RecurrenceSchema into an RRULE pattern string."""
        if recurrence.frequency == RecurrenceFrequency.daily:
            return "FREQ=DAILY"
        # weekly
        days = ",".join(recurrence.days_of_week)
        return f"FREQ=WEEKLY;BYDAY={days}"

    def _can_approve_overtime(self) -> bool:
        return self.current_member_role in OVERTIME_APPROVERS

    def _raise_overtime_violation(self, violations: list[dict]) -> None:
        """Approvers see WORKER_WOULD_ENTER_OVERTIME (409) and can re-submit with override.
        Non-approvers see OVERTIME_APPROVAL_REQUIRED (403) and must request manager approval."""
        first = violations[0]
        if self._can_approve_overtime():
            raise AppError(
                status_code=409,
                code="WORKER_WOULD_ENTER_OVERTIME",
                message=f"{first['worker_name']} would be scheduled for {first['total_hours']}h "
                        f"the week of {first['week_start']} — over the 40h overtime threshold.",
                details=violations,
            )
        raise AppError(
            status_code=403,
            code="OVERTIME_APPROVAL_REQUIRED",
            message=f"{first['worker_name']} would require overtime approval for the week of {first['week_start']}.",
            details=violations,
        )

    @staticmethod
    def _build_occurrence_response(shift: Shift, occurrence_date: date, mod: ShiftModification | None) -> ShiftOccurrenceResponse:
        """Merge master shift data with an optional modification for one occurrence."""
        if mod and mod.new_start_time:
            start_time = mod.new_start_time
        else:
            delta = shift.end_time - shift.start_time
            start_time = datetime.combine(occurrence_date, shift.start_time.timetz())

        if mod and mod.new_end_time:
            end_time = mod.new_end_time
        else:
            delta = shift.end_time - shift.start_time
            end_time = start_time + delta

        effective_status = mod.completion_status if mod else ShiftCompletionStatus.scheduled

        recurrence_frequency    = None
        recurrence_days_of_week = None
        if shift.is_recurring and shift.recurrence_rule:
            rule_upper = shift.recurrence_rule.upper()
            if "FREQ=DAILY" in rule_upper:
                recurrence_frequency = "daily"
            elif "FREQ=WEEKLY" in rule_upper:
                recurrence_frequency = "weekly"
                for part in rule_upper.split(";"):
                    if part.startswith("BYDAY="):
                        recurrence_days_of_week = part[len("BYDAY="):].split(",")

        worker = shift.worker
        return ShiftOccurrenceResponse(
            shift_id=shift.id,
            modification_id=mod.id if mod else None,
            date=occurrence_date,
            start_time=start_time,
            end_time=end_time,
            completion_status=effective_status,
            is_modification=mod is not None,
            is_recurring=shift.is_recurring,
            service_type=shift.service_type,
            worker=WorkerSummary(
                id=worker.id,
                first_name=worker.person.first_name,
                last_name=worker.person.last_name,
                email=worker.person.email,
            ),
            client=ClientSummary.model_validate(shift.client),
            location=shift.location,
            notes=mod.notes if mod else shift.notes,
            recurrence_end_date=shift.recurrence_end_date,
            recurrence_frequency=recurrence_frequency,
            recurrence_days_of_week=recurrence_days_of_week,
        )

    # ─────────────────────────────────────────
    # 1. Create a single or recurring shift
    # ─────────────────────────────────────────
    async def create_shift(self, payload: ShiftCreateSchema):
        try:
            is_recurring = payload.recurrence is not None
            recurrence_rule = None
            recurrence_end_date = None

            if is_recurring:
                recurrence_rule = self._build_rrule_string(payload.recurrence)
                recurrence_end_date = payload.recurrence.recurrence_end_date

            if not is_recurring:
                proposed_time_blocks = [(payload.start_time.date(), payload.start_time, payload.end_time)]
            else:
                cap_date = recurrence_end_date or (payload.start_time.date() + timedelta(days=365))
                rule = rrulestr(recurrence_rule, dtstart=payload.start_time)
                occurrences = rule.between(
                    datetime.combine(payload.start_time.date(), time.min),
                    datetime.combine(cap_date, time.max),
                    inc=True,
                )
                duration = payload.end_time - payload.start_time
                proposed_time_blocks = [(occ.date(), occ, occ + duration) for occ in occurrences]

            conflicts = self.checker.find_conflicts(
                worker_id=payload.worker_id,
                proposed_time_blocks=proposed_time_blocks,
            )
            if conflicts:
                first = conflicts[0]
                raise AppError(
                    status_code=409,
                    code="WORKER_ALREADY_SCHEDULED_AT_THIS_TIME_BLOCK",
                    message=f"Worker already scheduled on {first['date']} ({first['start']}–{first['end']}) for {first['client_name']}.",
                    details=conflicts,
                )

            if payload.override_hours_check and not self._can_approve_overtime():
                raise AppError(
                    status_code=403,
                    code="OVERTIME_APPROVAL_REQUIRED",
                    message="Only managers and owners can approve overtime.",
                )

            if not payload.override_hours_check:
                overtime_violations, cap_violations = self.checker.find_hours_violations(
                    worker_id=payload.worker_id,
                    proposed_time_blocks=proposed_time_blocks,
                )
                if overtime_violations:
                    self._raise_overtime_violation(overtime_violations)
                if cap_violations:
                    first = cap_violations[0]
                    raise AppError(
                        status_code=409,
                        code="WORKER_WOULD_EXCEED_WEEKLY_CAP",
                        message=f"{first['worker_name']} would be scheduled for {first['total_hours']}h the week of {first['week_start']} — over their {first['max_hours']}h/week cap.",
                        details=cap_violations,
                    )

            if payload.location:
                location = payload.location
            else:
                client = self.shift_repo.get_client_by_id(payload.client_id)
                if client:
                    location = f"{client.street}, {client.city}, {client.province} {client.postal_code}"
                else:
                    location = None

            shift = Shift(
                org_id=self.org_id,
                worker_id=payload.worker_id,
                client_id=payload.client_id,
                created_by=self.current_employment_id,
                start_time=payload.start_time,
                end_time=payload.end_time,
                service_type=payload.service_type,
                is_recurring=is_recurring,
                recurrence_rule=recurrence_rule,
                recurrence_end_date=recurrence_end_date,
                location=location,
                notes=payload.notes,
                overtime_approved=payload.override_hours_check or False,
            )
            self.shift_repo.add(shift)
            self.db.commit()
            self.db.refresh(shift)
            return shift

        except AppError:
            raise
        except Exception as e:
            self.db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 2a. Get occurrence counts by status (includes cancelled)
    # ─────────────────────────────────────────
    async def get_stats(
        self,
        from_date: date,
        to_date: date,
        worker_id: str | None = None,
        client_id: str | None = None,
    ) -> dict:
        try:
            shifts = self.shift_repo.get_shifts_in_range(self.org_id, to_date, worker_id, client_id)

            counts: dict[str, int] = {"scheduled": 0, "in_progress": 0, "completed": 0, "cancelled": 0}

            for shift in shifts:
                mod_map = {m.original_date: m for m in shift.modifications}
                occurrences = expand_occurrences(shift, from_date, to_date)

                for occ_date in occurrences:
                    mod = mod_map.get(occ_date)
                    status = mod.completion_status.value if mod else "scheduled"
                    counts[status] = counts.get(status, 0) + 1

            counts["total"] = sum(counts.values())
            return counts

        except AppError:
            raise
        except Exception as e:
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 2b. Worker stats — hours and overtime
    # ─────────────────────────────────────────
    def _calculate_hours_in_range(self, worker_id: str, from_date: date, to_date: date) -> float:
        """Total scheduled hours for a worker between from_date and to_date (inclusive)."""
        shifts = self.shift_repo.get_shifts_in_range(self.org_id, to_date, worker_id=worker_id)
        hours = 0.0
        for shift in shifts:
            mod_map = {m.original_date: m for m in shift.modifications}
            for occ_date in expand_occurrences(shift, from_date, to_date):
                timeblock = timeblock_for_occurrence(shift, occ_date, mod_map)
                if timeblock is None:
                    continue
                start, end = timeblock
                hours += (end - start).total_seconds() / 3600.0
        return round(hours, 2)

    def _calculate_overtime_in_range(self, worker_id: str, from_date: date, to_date: date, weekly_cap: int) -> float:
        """Sum of hours exceeding weekly_cap for each ISO week that overlaps from_date..to_date."""
        shifts = self.shift_repo.get_shifts_in_range(self.org_id, to_date, worker_id=worker_id)

        # Accumulate hours per ISO week key
        week_hours: dict[tuple[date, date], float] = {}
        for shift in shifts:
            mod_map = {m.original_date: m for m in shift.modifications}
            for occ_date in expand_occurrences(shift, from_date, to_date):
                timeblock = timeblock_for_occurrence(shift, occ_date, mod_map)
                if timeblock is None:
                    continue
                start, end = timeblock
                week_key = iso_week_range(occ_date)
                week_hours[week_key] = week_hours.get(week_key, 0.0) + (end - start).total_seconds() / 3600.0

        overtime = sum(max(0.0, h - weekly_cap) for h in week_hours.values())
        return round(overtime, 2)

    async def get_worker_stats(self, worker_id: str) -> dict:
        today = date.today()
        week_sun, week_sat = iso_week_range(today)
        month_start = today.replace(day=1)
        year_start = today.replace(month=1, day=1)

        worker = self.employment_repo.get_active_by_id_and_org(worker_id, self.org_id)
        cap = worker.max_hours_per_week if worker else None

        hours_this_week = self._calculate_hours_in_range(worker_id, week_sun, week_sat)
        hours_mtd = self._calculate_hours_in_range(worker_id, month_start, today)
        hours_ytd = self._calculate_hours_in_range(worker_id, year_start, today)

        overtime_mtd = self._calculate_overtime_in_range(worker_id, month_start, today, cap) if cap else 0.0
        overtime_ytd = self._calculate_overtime_in_range(worker_id, year_start, today, cap) if cap else 0.0

        return {
            "hours_this_week":    hours_this_week,
            "weekly_hour_cap":    cap,
            "hours_mtd":          hours_mtd,
            "hours_ytd":          hours_ytd,
            "overtime_mtd":       overtime_mtd,
            "overtime_ytd":       overtime_ytd,
            "punctuality_streak": None,
            "care_log_streak":    None,
        }

    # ─────────────────────────────────────────
    # 2c. Care metrics — scheduled vs delivered, with per-service breakdown
    # ─────────────────────────────────────────
    async def get_care_metrics(
        self,
        from_date: date,
        to_date: date,
        worker_id: str | None = None,
        client_id: str | None = None,
    ) -> dict:
        """Period totals of scheduled care (every non-cancelled occurrence) vs
        delivered care (completed occurrences), broken down per service. Delivered
        is provisional — derived from completed shifts until EVV lands."""
        try:
            occurrences = await self.get_shifts(from_date, to_date, worker_id, client_id)

            def hours(o) -> float:
                return (o.end_time - o.start_time).total_seconds() / 3600.0

            # service_type value (or None) → running tallies
            buckets: dict = {}
            sched_shifts = sched_hours = deliv_shifts = deliv_hours = 0.0
            for o in occurrences:
                svc = o.service_type.value if o.service_type else None
                b = buckets.setdefault(svc, {
                    "scheduled_shifts": 0, "scheduled_hours": 0.0,
                    "delivered_shifts": 0, "delivered_hours": 0.0,
                })
                h = hours(o)
                b["scheduled_shifts"] += 1
                b["scheduled_hours"] += h
                sched_shifts += 1
                sched_hours += h
                if o.completion_status == ShiftCompletionStatus.completed:
                    b["delivered_shifts"] += 1
                    b["delivered_hours"] += h
                    deliv_shifts += 1
                    deliv_hours += h

            # Named services first (alphabetical), Unspecified (None) last.
            ordered = sorted(buckets.keys(), key=lambda s: (s is None, s or ""))
            by_service = [
                {
                    "service_type": svc,
                    "scheduled_shifts": buckets[svc]["scheduled_shifts"],
                    "scheduled_hours": round(buckets[svc]["scheduled_hours"], 2),
                    "delivered_shifts": buckets[svc]["delivered_shifts"],
                    "delivered_hours": round(buckets[svc]["delivered_hours"], 2),
                }
                for svc in ordered
            ]

            return {
                "scheduled_shifts": int(sched_shifts),
                "scheduled_hours": round(sched_hours, 2),
                "delivered_shifts": int(deliv_shifts),
                "delivered_hours": round(deliv_hours, 2),
                "by_service": by_service,
            }

        except AppError:
            raise
        except Exception as e:
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 2. Get expanded occurrences for a date range
    # ─────────────────────────────────────────
    async def get_shifts(
        self,
        from_date: date,
        to_date: date,
        worker_id: str | None = None,
        client_id: str | None = None,
        completion_statuses: list[str] | None = None,
    ) -> list[ShiftOccurrenceResponse]:
        try:
            shifts = self.shift_repo.get_shifts_in_range(self.org_id, to_date, worker_id, client_id)

            results = []
            for shift in shifts:
                mod_map = {m.original_date: m for m in shift.modifications}
                occurrences = expand_occurrences(shift, from_date, to_date)

                for occurrence_date in occurrences:
                    mod = mod_map.get(occurrence_date)
                    effective_status = mod.completion_status if mod else ShiftCompletionStatus.scheduled

                    if completion_statuses is not None:
                        if effective_status.value not in completion_statuses:
                            continue
                    else:
                        if effective_status == ShiftCompletionStatus.cancelled:
                            continue

                    results.append(
                        self._build_occurrence_response(shift, occurrence_date, mod)
                    )

            results.sort(key=lambda o: o.start_time)
            return results

        except AppError:
            raise
        except Exception as e:
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 3. Get master shift record
    # ─────────────────────────────────────────
    async def get_shift(self, shift_id: str):
        try:
            return self._get_active_shift(shift_id)
        except AppError:
            raise
        except Exception as e:
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 4. Update master shift (affects all future occurrences)
    # ─────────────────────────────────────────
    async def update_shift(self, shift_id: str, payload: ShiftUpdateSchema):
        try:
            shift = self._get_active_shift(shift_id)

            updates = payload.model_dump(exclude_unset=True)

            if "recurrence" in updates:
                recurrence = updates.pop("recurrence")
                if recurrence and shift.is_recurring:
                    new_rule = self._build_rrule_string(payload.recurrence)
                    shift.recurrence_rule = new_rule
                    if payload.recurrence.recurrence_end_date:
                        shift.recurrence_end_date = payload.recurrence.recurrence_end_date
                    self.shift_repo.delete_modifications_from_date(shift_id, date.today())

            for field, value in updates.items():
                setattr(shift, field, value)

            self.db.commit()
            self.db.refresh(shift)
            return shift

        except AppError:
            raise
        except Exception as e:
            self.db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 5. Cancel entire shift schedule (soft delete)
    # ─────────────────────────────────────────
    async def cancel_shift(self, shift_id: str, payload: ShiftCancelSchema):
        try:
            shift = self._get_active_shift(shift_id)

            shift.status = ShiftStatus.cancelled
            shift.deleted_at = datetime.now(timezone.utc)
            shift.cancellation_reason = payload.cancellation_reason
            self.db.commit()

            return {"message": "Shift cancelled successfully"}

        except AppError:
            raise
        except Exception as e:
            self.db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 6. Create a modification for a specific occurrence
    # ─────────────────────────────────────────
    async def create_modification(self, shift_id: str, payload: ShiftModificationCreateSchema):
        try:
            master = self._get_active_shift(shift_id)

            if payload.new_start_time or payload.new_end_time:
                duration = master.end_time - master.start_time
                new_start = payload.new_start_time or datetime.combine(
                    payload.original_date, master.start_time.timetz()
                )
                new_end = payload.new_end_time or (new_start + duration)
                conflicts = self.checker.find_conflicts(
                    worker_id=master.worker_id,
                    proposed_time_blocks=[(payload.original_date, new_start, new_end)],
                    exclude_shift_id=shift_id,
                )
                if conflicts:
                    first = conflicts[0]
                    raise AppError(
                        status_code=409,
                        code="WORKER_ALREADY_SCHEDULED_AT_THIS_TIME_BLOCK",
                        message=f"Worker already scheduled on {first['date']} ({first['start']}–{first['end']}) for {first['client_name']}.",
                        details=conflicts,
                    )

                if payload.override_hours_check and not self._can_approve_overtime():
                    raise AppError(
                        status_code=403,
                        code="OVERTIME_APPROVAL_REQUIRED",
                        message="Only managers and owners can approve overtime.",
                    )

                if not payload.override_hours_check:
                    overtime_violations, cap_violations = self.checker.find_hours_violations(
                        worker_id=master.worker_id,
                        proposed_time_blocks=[(payload.original_date, new_start, new_end)],
                        exclude_shift_id=shift_id,
                    )
                    if overtime_violations:
                        self._raise_overtime_violation(overtime_violations)
                    if cap_violations:
                        first = cap_violations[0]
                        raise AppError(
                            status_code=409,
                            code="WORKER_WOULD_EXCEED_WEEKLY_CAP",
                            message=f"{first['worker_name']} would be scheduled for {first['total_hours']}h the week of {first['week_start']} — over their {first['max_hours']}h/week cap.",
                            details=cap_violations,
                        )

            existing = self.modification_repo.get_by_shift_and_date(shift_id, payload.original_date)

            if existing:
                updates = payload.model_dump(exclude_unset=True, exclude={"original_date", "override_hours_check"})
                for field, value in updates.items():
                    setattr(existing, field, value)
                if payload.completion_status == ShiftCompletionStatus.cancelled and not existing.cancelled_at:
                    existing.cancelled_at = datetime.now(timezone.utc)
            else:
                dump = payload.model_dump(exclude={"override_hours_check"})
                existing = ShiftModification(
                    shift_id=shift_id,
                    **dump,
                )
                if payload.completion_status == ShiftCompletionStatus.cancelled:
                    existing.cancelled_at = datetime.now(timezone.utc)
                self.modification_repo.add(existing)

            self.db.commit()
            self.db.refresh(existing)
            return existing

        except AppError:
            raise
        except Exception as e:
            self.db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 7. Update an existing modification
    # ─────────────────────────────────────────
    async def update_modification(
        self,
        shift_id: str,
        original_date: date,
        payload: ShiftModificationUpdateSchema,
    ):
        try:
            master = self._get_active_shift(shift_id)
            mod = self.modification_repo.get_modification_by_shift_and_date_required(shift_id, original_date)

            if payload.new_start_time or payload.new_end_time:
                duration = master.end_time - master.start_time
                new_start = payload.new_start_time or mod.new_start_time or datetime.combine(
                    original_date, master.start_time.timetz()
                )
                new_end = payload.new_end_time or mod.new_end_time or (new_start + duration)
                conflicts = self.checker.find_conflicts(
                    worker_id=master.worker_id,
                    proposed_time_blocks=[(original_date, new_start, new_end)],
                    exclude_shift_id=shift_id,
                )
                if conflicts:
                    first = conflicts[0]
                    raise AppError(
                        status_code=409,
                        code="WORKER_ALREADY_SCHEDULED_AT_THIS_TIME_BLOCK",
                        message=f"Worker already scheduled on {first['date']} ({first['start']}–{first['end']}) for {first['client_name']}.",
                        details=conflicts,
                    )

                if payload.override_hours_check and not self._can_approve_overtime():
                    raise AppError(
                        status_code=403,
                        code="OVERTIME_APPROVAL_REQUIRED",
                        message="Only managers and owners can approve overtime.",
                    )

                if not payload.override_hours_check:
                    overtime_violations, cap_violations = self.checker.find_hours_violations(
                        worker_id=master.worker_id,
                        proposed_time_blocks=[(original_date, new_start, new_end)],
                        exclude_shift_id=shift_id,
                    )
                    if overtime_violations:
                        self._raise_overtime_violation(overtime_violations)
                    if cap_violations:
                        first = cap_violations[0]
                        raise AppError(
                            status_code=409,
                            code="WORKER_WOULD_EXCEED_WEEKLY_CAP",
                            message=f"{first['worker_name']} would be scheduled for {first['total_hours']}h the week of {first['week_start']} — over their {first['max_hours']}h/week cap.",
                            details=cap_violations,
                        )

            updates = payload.model_dump(exclude_unset=True, exclude={"override_hours_check"})
            for field, value in updates.items():
                setattr(mod, field, value)

            self.db.commit()
            self.db.refresh(mod)
            return mod

        except AppError:
            raise
        except Exception as e:
            self.db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 8. Cancel this occurrence and all following
    # Truncates recurrence_end_date; cancels all if first occurrence
    # ─────────────────────────────────────────
    async def cancel_from_date(self, shift_id: str, payload: ShiftCancelFromSchema):
        try:
            shift = self._get_active_shift(shift_id)
            occurrence_date = payload.occurrence_date

            if occurrence_date <= shift.start_time.date():
                shift.status = ShiftStatus.cancelled
                shift.deleted_at = datetime.now(timezone.utc)
                shift.cancellation_reason = payload.cancellation_reason
            else:
                shift.recurrence_end_date = occurrence_date - timedelta(days=1)
                shift.cancellation_reason = payload.cancellation_reason
                self.shift_repo.delete_modifications_from_date(shift_id, occurrence_date)

            self.db.commit()
            return {"message": "Occurrences cancelled successfully"}

        except AppError:
            self.db.rollback()
            raise
        except Exception as e:
            self.db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 9. Edit this occurrence and all following (splits the series)
    # ─────────────────────────────────────────
    async def edit_from_date(self, shift_id: str, payload: ShiftEditFromSchema):
        try:
            shift = self._get_active_shift(shift_id)
            occurrence_date = payload.occurrence_date

            if occurrence_date <= shift.start_time.date():
                new_worker_id = payload.worker_id or shift.worker_id
                new_start_time = payload.new_start_time or shift.start_time
                new_end_time = payload.new_end_time or shift.end_time
                new_end_date = payload.recurrence_end_date or shift.recurrence_end_date

                cap_date = new_end_date or (new_start_time.date() + timedelta(days=365))
                if shift.is_recurring:
                    new_rule = self._build_rrule_string(payload.recurrence) if payload.recurrence else shift.recurrence_rule
                    rule = rrulestr(new_rule, dtstart=new_start_time)
                    occurrences = rule.between(
                        datetime.combine(new_start_time.date(), time.min),
                        datetime.combine(cap_date, time.max),
                        inc=True,
                    )
                    duration = new_end_time - new_start_time
                    proposed_time_blocks = [(occ.date(), occ, occ + duration) for occ in occurrences]
                else:
                    proposed_time_blocks = [(new_start_time.date(), new_start_time, new_end_time)]

                conflicts = self.checker.find_conflicts(
                    worker_id=new_worker_id,
                    proposed_time_blocks=proposed_time_blocks,
                    exclude_shift_id=shift_id,
                )
                if conflicts:
                    first = conflicts[0]
                    raise AppError(
                        status_code=409,
                        code="WORKER_ALREADY_SCHEDULED_AT_THIS_TIME_BLOCK",
                        message=f"Worker already scheduled on {first['date']} ({first['start']}–{first['end']}) for {first['client_name']}.",
                        details=conflicts,
                    )

                if payload.override_hours_check and not self._can_approve_overtime():
                    raise AppError(
                        status_code=403,
                        code="OVERTIME_APPROVAL_REQUIRED",
                        message="Only managers and owners can approve overtime.",
                    )

                if not payload.override_hours_check:
                    overtime_violations, cap_violations = self.checker.find_hours_violations(
                        worker_id=new_worker_id,
                        proposed_time_blocks=proposed_time_blocks,
                        exclude_shift_id=shift_id,
                    )
                    if overtime_violations:
                        self._raise_overtime_violation(overtime_violations)
                    if cap_violations:
                        first = cap_violations[0]
                        raise AppError(
                            status_code=409,
                            code="WORKER_WOULD_EXCEED_WEEKLY_CAP",
                            message=f"{first['worker_name']} would be scheduled for {first['total_hours']}h the week of {first['week_start']} — over their {first['max_hours']}h/week cap.",
                            details=cap_violations,
                        )

                if payload.override_hours_check:
                    shift.overtime_approved = True

                if payload.new_start_time:
                    shift.start_time = payload.new_start_time
                if payload.new_end_time:
                    shift.end_time = payload.new_end_time
                if payload.worker_id:
                    shift.worker_id = payload.worker_id
                if payload.client_id:
                    shift.client_id = payload.client_id
                if payload.service_type is not None:
                    shift.service_type = payload.service_type
                if payload.location is not None:
                    shift.location = payload.location
                if payload.recurrence_end_date is not None:
                    shift.recurrence_end_date = payload.recurrence_end_date
                if payload.notes is not None:
                    shift.notes = payload.notes
                self.db.commit()
                return {"message": "Shift updated"}

            original_end_date = shift.recurrence_end_date

            if payload.new_start_time:
                new_start = datetime.combine(occurrence_date, payload.new_start_time.timetz())
            else:
                new_start = datetime.combine(occurrence_date, shift.start_time.timetz())

            if payload.new_end_time:
                new_end = datetime.combine(occurrence_date, payload.new_end_time.timetz())
            else:
                delta = shift.end_time - shift.start_time
                new_end = new_start + delta

            new_rule = self._build_rrule_string(payload.recurrence) if payload.recurrence else shift.recurrence_rule
            new_end_date = (
                payload.recurrence.recurrence_end_date if payload.recurrence and payload.recurrence.recurrence_end_date is not None
                else payload.recurrence_end_date if payload.recurrence_end_date is not None
                else original_end_date
            )

            new_worker_id = payload.worker_id or shift.worker_id
            cap_date = new_end_date or (new_start.date() + timedelta(days=365))
            if shift.is_recurring:
                rule = rrulestr(new_rule, dtstart=new_start)
                occurrences = rule.between(
                    datetime.combine(new_start.date(), time.min),
                    datetime.combine(cap_date, time.max),
                    inc=True,
                )
                duration = new_end - new_start
                proposed_time_blocks = [(occ.date(), occ, occ + duration) for occ in occurrences]
            else:
                proposed_time_blocks = [(new_start.date(), new_start, new_end)]

            conflicts = self.checker.find_conflicts(
                worker_id=new_worker_id,
                proposed_time_blocks=proposed_time_blocks,
                exclude_shift_id=shift_id,
            )
            if conflicts:
                first = conflicts[0]
                raise AppError(
                    status_code=409,
                    code="WORKER_ALREADY_SCHEDULED_AT_THIS_TIME_BLOCK",
                    message=f"Worker already scheduled on {first['date']} ({first['start']}–{first['end']}) for {first['client_name']}.",
                    details=conflicts,
                )

            if not payload.override_hours_check:
                overtime_violations, cap_violations = self.checker.find_hours_violations(
                    worker_id=new_worker_id,
                    proposed_time_blocks=proposed_time_blocks,
                    exclude_shift_id=shift_id,
                )
                if overtime_violations:
                    first = overtime_violations[0]
                    raise AppError(
                        status_code=409,
                        code="WORKER_WOULD_ENTER_OVERTIME",
                        message=f"{first['worker_name']} would be scheduled for {first['total_hours']}h the week of {first['week_start']} — over the 40h overtime threshold.",
                        details=overtime_violations,
                    )
                if cap_violations:
                    first = cap_violations[0]
                    raise AppError(
                        status_code=409,
                        code="WORKER_WOULD_EXCEED_WEEKLY_CAP",
                        message=f"{first['worker_name']} would be scheduled for {first['total_hours']}h the week of {first['week_start']} — over their {first['max_hours']}h/week cap.",
                        details=cap_violations,
                    )

            shift.recurrence_end_date = occurrence_date - timedelta(days=1)
            self.shift_repo.delete_modifications_from_date(shift_id, occurrence_date)

            new_shift = Shift(
                id=uuid.uuid4(),
                org_id=shift.org_id,
                worker_id=new_worker_id,
                client_id=payload.client_id or shift.client_id,
                created_by=self.current_employment_id,
                start_time=new_start,
                end_time=new_end,
                service_type=payload.service_type if payload.service_type is not None else shift.service_type,
                is_recurring=shift.is_recurring,
                recurrence_rule=new_rule,
                recurrence_end_date=new_end_date,
                location=payload.location if payload.location is not None else shift.location,
                notes=payload.notes if payload.notes is not None else shift.notes,
                overtime_approved=payload.override_hours_check or False,
            )
            self.shift_repo.add(new_shift)
            self.db.commit()
            return {"message": "Shift updated from this occurrence"}

        except AppError:
            self.db.rollback()
            raise
        except Exception as e:
            self.db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))
