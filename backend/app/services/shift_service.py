from datetime import date, datetime, time, timedelta, timezone
import uuid
from dateutil.rrule import rrulestr
from sqlalchemy.orm import Session
from supabase_auth.types import User as SupabaseUser
from app.models.shift import Shift
from app.models.shift_modification import ShiftModification
from app.core.enums import ShiftCompletionStatus, ShiftStatus, RecurrenceFrequency
from app.core.exceptions import AppError
from app.schemas.shift import (
    CancelFromSchema,
    CancelShiftSchema,
    EditFromSchema,
    ShiftCreateSchema,
    ShiftModificationCreateSchema,
    ShiftModificationUpdateSchema,
    ShiftOccurrenceResponse,
    ShiftUpdateSchema,
)
from app.services.org_service import OrgService
from app.repositories.shift_repository import ShiftRepository, ShiftModificationRepository


class ShiftService:

    def __init__(self, db: Session, current_user: SupabaseUser):
        self.db = db
        self.current_user = current_user
        self.shift_repo = ShiftRepository(db)
        self.modification_repo = ShiftModificationRepository(db)
        self.org_id = OrgService.get_admin_org_id(current_user, db)

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

    @staticmethod
    def _expand_occurrences(shift: Shift, from_date: date, to_date: date) -> list[date]:
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
            datetime.combine(from_date, time.min, tzinfo=timezone.utc),
            datetime.combine(cap, time.max, tzinfo=timezone.utc),
            inc=True,
        )
        return [dt.date() for dt in occurrences]

    @staticmethod
    def _shift_has_occurrence_on(shift: Shift, target_date: date) -> bool:
        """Does this shift have an occurrence on target_date?"""
        if not shift.is_recurring:
            return shift.start_time.date() == target_date

        end_bound = shift.recurrence_end_date
        if end_bound and target_date > end_bound:
            return False

        rule = rrulestr(shift.recurrence_rule, dtstart=shift.start_time)
        matches = rule.between(
            datetime.combine(target_date, time.min, tzinfo=timezone.utc),
            datetime.combine(target_date, time.max, tzinfo=timezone.utc),
            inc=True,
        )
        return len(matches) > 0

    @staticmethod
    def _get_timeblock_for_shift_occurrence_on_date(
        shift: Shift,
        target_date: date,
        shift_mod_map: dict,
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

    @staticmethod
    def _times_overlap(start_a: datetime, end_a: datetime, start_b: datetime, end_b: datetime) -> bool:
        """Do two time windows overlap?"""
        return start_a < end_b and end_a > start_b

    def _find_scheduling_conflicts(
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
                if not self._shift_has_occurrence_on(existing_shift, target_date):
                    continue

                timeblock = self._get_timeblock_for_shift_occurrence_on_date(
                    existing_shift, target_date, shift_mod_map
                )
                if timeblock is None:
                    continue

                existing_start, existing_end = timeblock
                if self._times_overlap(proposed_start, proposed_end, existing_start, existing_end):
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

        stored_status = mod.completion_status if mod else ShiftCompletionStatus.scheduled
        now = datetime.now(timezone.utc)
        if stored_status == ShiftCompletionStatus.scheduled:
            if start_time <= now <= end_time:
                effective_status = ShiftCompletionStatus.in_progress
            else:
                effective_status = ShiftCompletionStatus.scheduled
        else:
            effective_status = stored_status

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

        return ShiftOccurrenceResponse(
            shift_id=shift.id,
            modification_id=mod.id if mod else None,
            date=occurrence_date,
            start_time=start_time,
            end_time=end_time,
            completion_status=effective_status,
            is_modification=mod is not None,
            is_recurring=shift.is_recurring,
            worker=shift.worker,
            client=shift.client,
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
                    datetime.combine(payload.start_time.date(), time.min, tzinfo=timezone.utc),
                    datetime.combine(cap_date, time.max, tzinfo=timezone.utc),
                    inc=True,
                )
                duration = payload.end_time - payload.start_time
                proposed_time_blocks = [(occ.date(), occ, occ + duration) for occ in occurrences]

            conflicts = self._find_scheduling_conflicts(
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
                created_by=self.current_user.id,
                start_time=payload.start_time,
                end_time=payload.end_time,
                is_recurring=is_recurring,
                recurrence_rule=recurrence_rule,
                recurrence_end_date=recurrence_end_date,
                location=location,
                notes=payload.notes,
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
                occurrences = self._expand_occurrences(shift, from_date, to_date)

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
                occurrences = self._expand_occurrences(shift, from_date, to_date)

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
                    today = datetime.now(timezone.utc).date()
                    self.shift_repo.delete_modifications_from_date(shift_id, today)

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
    async def cancel_shift(self, shift_id: str, payload: CancelShiftSchema):
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
                conflicts = self._find_scheduling_conflicts(
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

            existing = self.modification_repo.get_by_shift_and_date(shift_id, payload.original_date)

            if existing:
                updates = payload.model_dump(exclude_unset=True, exclude={"original_date"})
                for field, value in updates.items():
                    setattr(existing, field, value)
                if payload.completion_status == ShiftCompletionStatus.cancelled and not existing.cancelled_at:
                    existing.cancelled_at = datetime.now(timezone.utc)
            else:
                existing = ShiftModification(
                    shift_id=shift_id,
                    **payload.model_dump(),
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
                conflicts = self._find_scheduling_conflicts(
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

            updates = payload.model_dump(exclude_unset=True)
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
    async def cancel_from_date(self, shift_id: str, payload: CancelFromSchema):
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
    async def edit_from_date(self, shift_id: str, payload: EditFromSchema):
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
                        datetime.combine(new_start_time.date(), time.min, tzinfo=timezone.utc),
                        datetime.combine(cap_date, time.max, tzinfo=timezone.utc),
                        inc=True,
                    )
                    duration = new_end_time - new_start_time
                    proposed_time_blocks = [(occ.date(), occ, occ + duration) for occ in occurrences]
                else:
                    proposed_time_blocks = [(new_start_time.date(), new_start_time, new_end_time)]

                conflicts = self._find_scheduling_conflicts(
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

                if payload.new_start_time:
                    shift.start_time = payload.new_start_time
                if payload.new_end_time:
                    shift.end_time = payload.new_end_time
                if payload.worker_id:
                    shift.worker_id = payload.worker_id
                if payload.client_id:
                    shift.client_id = payload.client_id
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
                    datetime.combine(new_start.date(), time.min, tzinfo=timezone.utc),
                    datetime.combine(cap_date, time.max, tzinfo=timezone.utc),
                    inc=True,
                )
                duration = new_end - new_start
                proposed_time_blocks = [(occ.date(), occ, occ + duration) for occ in occurrences]
            else:
                proposed_time_blocks = [(new_start.date(), new_start, new_end)]

            conflicts = self._find_scheduling_conflicts(
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

            shift.recurrence_end_date = occurrence_date - timedelta(days=1)
            self.shift_repo.delete_modifications_from_date(shift_id, occurrence_date)

            new_shift = Shift(
                id=uuid.uuid4(),
                org_id=shift.org_id,
                worker_id=new_worker_id,
                client_id=payload.client_id or shift.client_id,
                created_by=self.current_user.id,
                start_time=new_start,
                end_time=new_end,
                is_recurring=shift.is_recurring,
                recurrence_rule=new_rule,
                recurrence_end_date=new_end_date,
                location=payload.location if payload.location is not None else shift.location,
                notes=payload.notes if payload.notes is not None else shift.notes,
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
