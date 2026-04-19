from datetime import date, datetime, time, timezone
from dateutil.rrule import rrulestr
from sqlalchemy.orm import Session, joinedload
from supabase_auth.types import User as SupabaseUser
from app.models.shift import Shift
from app.models.shift_modification import ShiftModification
from app.models.client import Client
from app.core.enums import ShiftCompletionStatus, ShiftStatus, RecurrenceFrequency
from app.core.exceptions import AppError
from app.schemas.shift import (
    ShiftCreateSchema,
    ShiftModificationCreateSchema,
    ShiftModificationUpdateSchema,
    ShiftOccurrenceResponse,
    ShiftUpdateSchema,
)
from app.services.org_service import OrgService


class ShiftService:

    # ─────────────────────────────────────────
    # Internal helpers
    # ─────────────────────────────────────────

    @staticmethod
    def _get_active_shift(shift_id: str, org_id, db: Session) -> Shift:
        shift = (
            db.query(Shift)
            .options(
                joinedload(Shift.worker),
                joinedload(Shift.client),
                joinedload(Shift.modifications),
            )
            .filter(
                Shift.id == shift_id,
                Shift.org_id == org_id,
                Shift.deleted_at == None,  # noqa: E711
            )
            .first()
        )
        if not shift:
            raise AppError(status_code=404, code="NOT_FOUND", message="Shift not found")
        return shift

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
        # Cap expansion at the earlier of to_date and recurrence_end_date
        cap = min(to_date, effective_end)

        rule = rrulestr(rule_str, dtstart=shift.start_time)
        occurrences = rule.between(
            datetime.combine(from_date, time.min, tzinfo=timezone.utc),
            datetime.combine(cap, time.max, tzinfo=timezone.utc),
            inc=True,
        )
        return [dt.date() for dt in occurrences]

    @staticmethod
    def _build_occurrence_response(shift: Shift, occurrence_date: date, mod: ShiftModification | None) -> ShiftOccurrenceResponse:
        """Merge master shift data with an optional modification for one occurrence."""
        # Time: use override if present, otherwise reconstruct from master using the occurrence date
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

        return ShiftOccurrenceResponse(
            shift_id=shift.id,
            modification_id=mod.id if mod else None,
            date=occurrence_date,
            start_time=start_time,
            end_time=end_time,
            completion_status=mod.completion_status if mod else ShiftCompletionStatus.scheduled,
            is_modification=mod is not None,
            is_recurring=shift.is_recurring,
            worker=shift.worker,
            client=shift.client,
            location=shift.location,
            notes=mod.notes if mod else shift.notes,
        )

    # ─────────────────────────────────────────
    # 1. Create a single or recurring shift
    # ─────────────────────────────────────────
    @staticmethod
    async def create_shift(payload: ShiftCreateSchema, current_user: SupabaseUser, db: Session):
        try:
            org_id = OrgService.get_admin_org_id(current_user, db)

            is_recurring = payload.recurrence is not None
            recurrence_rule = None
            recurrence_end_date = None

            if is_recurring:
                recurrence_rule = ShiftService._build_rrule_string(payload.recurrence)
                recurrence_end_date = payload.recurrence.recurrence_end_date

            if payload.location:
                location = payload.location
            else:
                client = db.query(Client).filter(Client.id == payload.client_id).first()
                if client:
                    location = f"{client.street}, {client.city}, {client.province} {client.postal_code}"
                else:
                    location = None

            shift = Shift(
                org_id=org_id,
                worker_id=payload.worker_id,
                client_id=payload.client_id,
                created_by=current_user.id,
                start_time=payload.start_time,
                end_time=payload.end_time,
                is_recurring=is_recurring,
                recurrence_rule=recurrence_rule,
                recurrence_end_date=recurrence_end_date,
                location=location,
                notes=payload.notes,
            )
            db.add(shift)
            db.commit()
            db.refresh(shift)
            return shift

        except AppError:
            raise
        except Exception as e:
            db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 2a. Get occurrence counts by status (includes cancelled)
    # ─────────────────────────────────────────
    @staticmethod
    async def get_stats(
        from_date: date,
        to_date: date,
        current_user: SupabaseUser,
        db: Session,
        worker_id: str | None = None,
        client_id: str | None = None,
    ) -> dict:
        try:
            org_id = OrgService.get_admin_org_id(current_user, db)

            query = (
                db.query(Shift)
                .options(joinedload(Shift.modifications))
                .filter(
                    Shift.org_id == org_id,
                    Shift.status == ShiftStatus.active,
                    Shift.deleted_at == None,  # noqa: E711
                    Shift.start_time <= datetime.combine(to_date, time.max, tzinfo=timezone.utc),
                )
            )
            if worker_id:
                query = query.filter(Shift.worker_id == worker_id)
            if client_id:
                query = query.filter(Shift.client_id == client_id)

            shifts = query.all()

            counts: dict[str, int] = {"scheduled": 0, "in_progress": 0, "completed": 0, "cancelled": 0}

            for shift in shifts:
                mod_map = {m.original_date: m for m in shift.modifications}
                occurrences = ShiftService._expand_occurrences(shift, from_date, to_date)

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
    @staticmethod
    async def get_shifts(
        from_date: date,
        to_date: date,
        current_user: SupabaseUser,
        db: Session,
        worker_id: str | None = None,
        client_id: str | None = None,
    ) -> list[ShiftOccurrenceResponse]:
        try:
            org_id = OrgService.get_admin_org_id(current_user, db)

            query = (
                db.query(Shift)
                .options(
                    joinedload(Shift.worker),
                    joinedload(Shift.client),
                    joinedload(Shift.modifications),
                )
                .filter(
                    Shift.org_id == org_id,
                    Shift.status == ShiftStatus.active,
                    Shift.deleted_at == None,  # noqa: E711
                    Shift.start_time <= datetime.combine(to_date, time.max, tzinfo=timezone.utc),
                )
            )

            if worker_id:
                query = query.filter(Shift.worker_id == worker_id)
            if client_id:
                query = query.filter(Shift.client_id == client_id)

            shifts = query.all()

            results = []
            for shift in shifts:
                # Build a lookup map: original_date → ShiftModification
                mod_map = {m.original_date: m for m in shift.modifications}

                occurrences = ShiftService._expand_occurrences(shift, from_date, to_date)

                for occurrence_date in occurrences:
                    mod = mod_map.get(occurrence_date)
                    # Skip cancelled individual occurrences
                    if mod and mod.completion_status == ShiftCompletionStatus.cancelled:
                        continue
                    results.append(
                        ShiftService._build_occurrence_response(shift, occurrence_date, mod)
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
    @staticmethod
    async def get_shift(shift_id: str, current_user: SupabaseUser, db: Session):
        try:
            org_id = OrgService.get_admin_org_id(current_user, db)
            return ShiftService._get_active_shift(shift_id, org_id, db)
        except AppError:
            raise
        except Exception as e:
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 4. Update master shift (affects all future occurrences)
    # ─────────────────────────────────────────
    @staticmethod
    async def update_shift(shift_id: str, payload: ShiftUpdateSchema, current_user: SupabaseUser, db: Session):
        try:
            org_id = OrgService.get_admin_org_id(current_user, db)
            shift = ShiftService._get_active_shift(shift_id, org_id, db)

            updates = payload.model_dump(exclude_unset=True)
            for field, value in updates.items():
                setattr(shift, field, value)

            db.commit()
            db.refresh(shift)
            return shift

        except AppError:
            raise
        except Exception as e:
            db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 5. Cancel entire shift schedule (soft delete)
    # ─────────────────────────────────────────
    @staticmethod
    async def cancel_shift(shift_id: str, current_user: SupabaseUser, db: Session):
        try:
            org_id = OrgService.get_admin_org_id(current_user, db)
            shift = ShiftService._get_active_shift(shift_id, org_id, db)

            shift.status = ShiftStatus.cancelled
            shift.deleted_at = datetime.now(timezone.utc)
            db.commit()

            return {"message": "Shift cancelled successfully"}

        except AppError:
            raise
        except Exception as e:
            db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 6. Create a modification for a specific occurrence
    # ─────────────────────────────────────────
    @staticmethod
    async def create_modification(
        shift_id: str,
        payload: ShiftModificationCreateSchema,
        current_user: SupabaseUser,
        db: Session,
    ):
        try:
            org_id = OrgService.get_admin_org_id(current_user, db)
            ShiftService._get_active_shift(shift_id, org_id, db)

            # Upsert — update if already exists for this date
            existing = (
                db.query(ShiftModification)
                .filter(
                    ShiftModification.shift_id == shift_id,
                    ShiftModification.original_date == payload.original_date,
                )
                .first()
            )

            if existing:
                updates = payload.model_dump(exclude_unset=True, exclude={"original_date"})
                for field, value in updates.items():
                    setattr(existing, field, value)
            else:
                existing = ShiftModification(
                    shift_id=shift_id,
                    **payload.model_dump(),
                )
                db.add(existing)

            db.commit()
            db.refresh(existing)
            return existing

        except AppError:
            raise
        except Exception as e:
            db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 7. Update an existing modification
    # ─────────────────────────────────────────
    @staticmethod
    async def update_modification(
        shift_id: str,
        original_date: date,
        payload: ShiftModificationUpdateSchema,
        current_user: SupabaseUser,
        db: Session,
    ):
        try:
            org_id = OrgService.get_admin_org_id(current_user, db)
            ShiftService._get_active_shift(shift_id, org_id, db)

            mod = (
                db.query(ShiftModification)
                .filter(
                    ShiftModification.shift_id == shift_id,
                    ShiftModification.original_date == original_date,
                )
                .first()
            )
            if not mod:
                raise AppError(status_code=404, code="NOT_FOUND", message="Modification not found")

            updates = payload.model_dump(exclude_unset=True)
            for field, value in updates.items():
                setattr(mod, field, value)

            db.commit()
            db.refresh(mod)
            return mod

        except AppError:
            raise
        except Exception as e:
            db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))
