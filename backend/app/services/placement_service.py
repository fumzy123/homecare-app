from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo
import hashlib
import json
from collections import defaultdict
from app.models.placement import CareSlotAssignment
from app.domain.care_coverage import end_previous_coverage
from app.services.authorization_compliance_service import AuthorizationComplianceService
from types import SimpleNamespace
from uuid import UUID
from sqlalchemy.orm import Session
from app.core.exceptions import AppError
from app.core.enums import (
    PlacementStatus,
    WeekDay,
    ServiceType,
    CareArrangement,
    ClientStatus,
)
from app.models.shift import Shift
from app.repositories.placement_repository import PlacementRepository
from app.repositories.organization_repository import OrganizationRepository
from app.repositories.client_repository import ClientRepository
from app.repositories.weekly_care_need_repository import WeeklyCareNeedRepository
from app.repositories.worker_availability_repository import WorkerAvailabilityRepository
from app.repositories.authorization_repository import AuthorizationRepository
from app.repositories.shift_repository import ShiftRepository
from app.domain.scheduling import (
    SchedulingChecker,
    care_slots_to_time_blocks,
    WEEKDAY_INDEX,
)
from app.domain.availability import availability_covers_care_need
from app.services.notification_service import NotificationService
from app.services.billing_cutoff_service import BillingCutoffService
from app.schemas.placement import (
    PlacementCreateSchema,
    PlacementResponse,
    PlacementDetailResponse,
    WorkerPlacementResponse,
    InterestWorkerSummary,
    InterestEligibility,
)

# Labels used to render the care-need snapshot text frozen onto a placement.
_WEEKDAY_LABELS = {
    WeekDay.MO: "Mon",
    WeekDay.TU: "Tue",
    WeekDay.WE: "Wed",
    WeekDay.TH: "Thu",
    WeekDay.FR: "Fri",
    WeekDay.SA: "Sat",
    WeekDay.SU: "Sun",
}
_WEEKDAY_ORDER = {
    d: i
    for i, d in enumerate(
        [
            WeekDay.MO,
            WeekDay.TU,
            WeekDay.WE,
            WeekDay.TH,
            WeekDay.FR,
            WeekDay.SA,
            WeekDay.SU,
        ]
    )
}
_SERVICE_LABELS = {
    ServiceType.personal_care: "Personal Care",
    ServiceType.companionship: "Companionship",
    ServiceType.respite: "Respite",
    ServiceType.nursing: "Nursing",
    ServiceType.homemaking: "Homemaking",
}


class PlacementService:
    def __init__(self, db: Session, current_user, org_id: UUID):
        self.db = db
        self.current_user = current_user
        self.org_id = org_id
        self.placement_repo = PlacementRepository(db)
        self.client_repo = ClientRepository(db)
        self.care_need_repo = WeeklyCareNeedRepository(db)
        self.availability_repo = WorkerAvailabilityRepository(db)
        self.auth_repo = AuthorizationRepository(db)
        self.shift_repo = ShiftRepository(db)
        self.cutoff_service = BillingCutoffService(db)
        self.checker = SchedulingChecker(db, org_id)
        employment = OrganizationRepository(db).get_active_employment_for_user(
            current_user.id
        )
        if not employment:
            raise AppError(
                status_code=404, code="NOT_FOUND", message="Member record not found"
            )
        self.employment_id = employment.id

    # ── Admin actions ─────────────────────────────────────────────────────────

    def create_placement(
        self, payload: PlacementCreateSchema
    ) -> PlacementDetailResponse:
        try:
            return self._create_placement(payload)
        except Exception:
            self.db.rollback()
            raise

    def _create_placement(
        self, payload: PlacementCreateSchema
    ) -> PlacementDetailResponse:
        # The address and weekly care need are snapshotted from the client now,
        # so the opportunity a worker sees stays exactly what was advertised even
        # if the client's plan or address later changes.
        OrganizationRepository(self.db).lock_by_id(self.org_id)
        need = self.care_need_repo.get(payload.weekly_care_need_id, self.org_id)
        if not need or need.client_id != payload.client_id:
            raise AppError(404, "NOT_FOUND", "Weekly Care Need not found")
        if self.care_need_repo.latest(payload.client_id).id != need.id:
            raise AppError(
                409, "SUPERSEDED_CARE_NEED", "Post the latest Weekly Care Need"
            )
        if need.imported:
            raise AppError(
                409,
                "IMPORTED_CARE_NEED",
                "Save a new Weekly Care Need version before posting; existing coverage is preserved until approval",
            )
        existing = self.placement_repo.for_care_need(need.id)
        if existing:
            if existing.status == PlacementStatus.closed and not need.ends_on:
                existing.status = PlacementStatus.open
                existing.resolved_at = None
                self.db.commit()
            return self._to_detail(existing)
        if not need.care_slots:
            raise AppError(400, "NO_CARE_SLOTS", "Add Care Slots before posting")
        client = self.client_repo.get_active_client(payload.client_id, self.org_id)
        if not client:
            raise AppError(
                status_code=404, code="NOT_FOUND", message="Client not found"
            )
        location = self._format_address(client)
        if client.status != ClientStatus.active:
            raise AppError(
                409, "CLIENT_NOT_ACTIVE", "Only active clients can have open placements"
            )
        entries = need.care_slots
        care_need = self._format_care_need(entries)
        snapshot = [self._slot_to_snapshot(e) for e in entries]

        try:
            placement = self.placement_repo.create(
                org_id=self.org_id,
                client_id=payload.client_id,
                created_by=self.employment_id,
                shift_description=care_need,
                masked_location=location,
                requirements=payload.requirements,
                start_date=need.effective_from,
                care_slot_snapshot=snapshot,
            )

            placement.weekly_care_need_id = need.id

            # Notify all workers in the same transaction: if the fan-out fails,
            # the placement is rolled back rather than left orphaned.
            notification_svc = NotificationService(
                self.db, current_user_id=self.employment_id
            )
            notification_svc.notify_placement_created(
                org_id=self.org_id,
                placement_id=placement.id,
                admin_id=self.employment_id,
                client_id=payload.client_id,
                client_name=f"{client.first_name} {client.last_name}",
                masked_location=location,
                shift_description=care_need,
                requirements=payload.requirements,
                commit=False,
            )

            self.db.commit()
        except Exception:
            self.db.rollback()
            raise

        self.db.refresh(placement)
        return self._to_detail(placement)

    # ── Snapshot builders ──────────────────────────────────────────────────────

    @staticmethod
    def _format_address(client) -> str:
        """Full client address shown to workers (street included)."""
        return f"{client.street}, {client.city}, {client.province} {client.postal_code}"

    @staticmethod
    def _fmt_time(t) -> str:
        """12-hour, human label: 9am, 7pm, 9:30am."""
        suffix = "am" if t.hour < 12 else "pm"
        hour12 = t.hour % 12 or 12
        return f"{hour12}:{t.minute:02d}{suffix}" if t.minute else f"{hour12}{suffix}"

    @staticmethod
    def _slot_to_snapshot(e) -> dict:
        """Serialize one care-need entry for the frozen JSON snapshot."""
        return {
            "id": str(e.id),
            "day_of_week": e.day_of_week.value,
            "start_time": e.start_time.isoformat(),
            "end_time": e.end_time.isoformat(),
            "service_type": e.service_type.value,
        }

    def _format_care_need(self, entries) -> str:
        """Render the client's weekly care need as a frozen text block, e.g.
        "Mon · 9am–7pm · Personal Care"."""
        if not entries:
            return "No weekly care need has been set for this client yet."
        ordered = sorted(
            entries,
            key=lambda e: (_WEEKDAY_ORDER.get(e.day_of_week, 99), e.start_time),
        )
        lines = [
            f"{_WEEKDAY_LABELS.get(e.day_of_week, e.day_of_week.value)} · "
            f"{self._fmt_time(e.start_time)}–{self._fmt_time(e.end_time)} · "
            f"{_SERVICE_LABELS.get(e.service_type, e.service_type.value)}"
            for e in ordered
        ]
        return "\n".join(lines)

    def list_placements(
        self, status: PlacementStatus | None = None
    ) -> list[PlacementResponse]:
        placements = self.placement_repo.list_for_org(self.org_id, status)
        return [self._to_response(p) for p in placements]

    def get_placement(self, placement_id: UUID) -> PlacementDetailResponse:
        placement = self._get_or_404(placement_id)
        return self._to_detail(placement)

    def preview_assignment(self, placement_id: UUID, employment_id: UUID):
        placement = self._get_or_404(placement_id)
        self._require_open(placement)
        worker = self._assignment_worker(employment_id)
        client, entries, today, start = self._assignment_context(placement)
        return dict(
            employment_id=worker.id,
            worker_name=f"{worker.person.first_name} {worker.person.last_name}",
            eligibility=self._eligibility_for(worker, entries, client, start, today),
        )

    def assign_worker(self, placement_id: UUID, employment_id: UUID):
        raise AppError(
            409,
            "CARE_SLOT_REVIEW_REQUIRED",
            "Review selected Care Slots before approving coverage",
        )

    def fill_placement(self, placement_id: UUID, employment_id: UUID):
        raise AppError(
            409,
            "CARE_SLOT_REVIEW_REQUIRED",
            "Review selected Care Slots before approving coverage",
        )

    @staticmethod
    def _require_open(placement):
        if placement.status != PlacementStatus.open:
            raise AppError(409, "PLACEMENT_NOT_OPEN", "Placement is no longer open")

    def _assignment_worker(self, employment_id):
        worker = self.placement_repo.active_worker(employment_id, self.org_id)
        if not worker:
            raise AppError(
                404,
                "WORKER_NOT_AVAILABLE",
                "An active worker in this agency is required",
            )
        return worker

    def _assignment_context(self, placement):
        client = self.client_repo.get_active_client(placement.client_id, self.org_id)
        if not client:
            raise AppError(404, "NOT_FOUND", "Client not found")
        entries = self._parse_snapshot(placement.care_slot_snapshot)
        if not entries:
            raise AppError(
                400,
                "NO_CARE_NEED",
                "This placement has no weekly care need to schedule",
            )
        for index, entry in enumerate(entries):
            if entry.end_time <= entry.start_time or any(
                entry.day_of_week == other.day_of_week
                and entry.start_time < other.end_time
                and other.start_time < entry.end_time
                for other in entries[:index]
            ):
                raise AppError(
                    409,
                    "INVALID_CARE_NEED",
                    "The saved care need contains invalid or overlapping times; close and repost it with a corrected plan",
                )
        today = date.today()
        start = self._effective_start(placement, today)
        horizon = self._check_horizon(client, start, today)
        if not care_slots_to_time_blocks(entries, start, horizon):
            raise AppError(
                409,
                "NO_SCHEDULE_WINDOW",
                "No care-need visits fall within the scheduling window",
            )
        return client, entries, today, start

    def close_placement(self, placement_id: UUID) -> PlacementDetailResponse:
        try:
            OrganizationRepository(self.db).lock_by_id(self.org_id)
            placement = self.placement_repo.lock_for_org(placement_id, self.org_id)
            if not placement:
                raise AppError(404, "NOT_FOUND", "Placement not found")
            self._require_open(placement)
            interested = [i.employment_id for i in placement.interests]
            self.placement_repo.close(placement)
            NotificationService(self.db, self.employment_id).resolve_placement_interest(
                self.org_id, placement.id, []
            )

            # Tell interested workers the placement is no longer available.
            notification_svc = NotificationService(
                self.db, current_user_id=self.employment_id
            )
            notification_svc.notify_placement_closed(
                org_id=self.org_id,
                placement_id=placement.id,
                masked_location=placement.masked_location,
                recipient_ids=interested,
                triggered_by_id=self.employment_id,
                commit=False,
            )

            self.db.commit()
        except Exception:
            self.db.rollback()
            raise

        self.db.refresh(placement)
        return self._to_detail(placement)

    # ── Worker actions ────────────────────────────────────────────────────────

    def get_for_worker(self, placement_id: UUID) -> WorkerPlacementResponse:
        placement = self.placement_repo.get_by_id(placement_id)
        if not placement or placement.org_id != self.org_id:
            raise AppError(
                status_code=404, code="NOT_FOUND", message="Placement not found"
            )
        self._assignment_worker(self.employment_id)
        interest = self.placement_repo.get_interest(placement_id, self.employment_id)
        has_interest = bool(interest)
        return WorkerPlacementResponse(
            id=placement.id,
            status=placement.status,
            client_first_name=placement.client.first_name,
            client_last_name=placement.client.last_name,
            masked_location=placement.masked_location,
            shift_description=placement.shift_description,
            requirements=placement.requirements,
            start_date=placement.start_date,
            scheduled_from=placement.weekly_care_need.scheduled_from if placement.weekly_care_need else None,
            created_at=placement.created_at,
            has_interest=has_interest,
            interest_note=interest.note if interest else None,
            care_slots=self._slot_rows(placement),
            interested_care_slot_ids=interest.care_slot_ids if interest else [],
        )

    def express_interest(self, placement_id, employment_id, note, care_slot_ids):
        try:
            OrganizationRepository(self.db).lock_by_id(self.org_id)
            placement = self.placement_repo.lock_for_org(placement_id, self.org_id)
            if not placement:
                raise AppError(404, "NOT_FOUND", "Placement not found")
            self._require_open(placement)
            self._assignment_worker(employment_id)
            if not placement.weekly_care_need_id:
                raise AppError(
                    409,
                    "LEGACY_PLACEMENT",
                    "Ask the agency to repost this Weekly Care Need",
                )
            need = placement.weekly_care_need
            if need.ends_on or (
                not need.activated_at
                and self.care_need_repo.latest(need.client_id).id != need.id
            ):
                raise AppError(
                    409,
                    "SUPERSEDED_CARE_NEED",
                    "This Weekly Care Need has been replaced",
                )
            selected = {str(slot) for slot in care_slot_ids}
            available = {
                row["id"] for row in self._slot_rows(placement) if not row["worker_id"]
            }
            if not selected or not selected.issubset(available):
                raise AppError(
                    409, "CARE_SLOT_UNAVAILABLE", "Select available Care Slots"
                )
            interest = self.placement_repo.get_interest(placement_id, employment_id)
            if not interest:
                interest = self.placement_repo.add_interest(
                    placement_id, employment_id, note
                )
            interest.care_slot_ids, interest.note = sorted(selected), note
            NotificationService(self.db, self.employment_id).notify_placement_interest(
                self.org_id, placement.id, employment_id, sorted(selected)
            )
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise

    def withdraw_interest(self, placement_id: UUID, employment_id: UUID) -> None:
        try:
            OrganizationRepository(self.db).lock_by_id(self.org_id)
            self._get_or_404(placement_id)
            self._assignment_worker(employment_id)
            interest = self.placement_repo.get_interest(placement_id, employment_id)
            if not interest:
                raise AppError(404, "NOT_FOUND", "No interest record found")
            self.placement_repo.remove_interest(interest)
            NotificationService(self.db, self.employment_id).resolve_worker_interest(
                self.org_id, placement_id, employment_id
            )
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _get_or_404(self, placement_id: UUID):
        placement = self.placement_repo.get_by_id(placement_id)
        if not placement or placement.org_id != self.org_id:
            raise AppError(
                status_code=404, code="NOT_FOUND", message="Placement not found"
            )
        return placement

    def _to_response(self, p) -> PlacementResponse:
        slot_rows = self._slot_rows(p)
        return PlacementResponse(
            id=p.id,
            org_id=p.org_id,
            client_id=p.client_id,
            client_first_name=p.client.first_name,
            client_last_name=p.client.last_name,
            created_by=p.created_by,
            shift_description=p.shift_description,
            requirements=p.requirements,
            masked_location=p.masked_location,
            start_date=p.start_date,
            scheduled_from=p.weekly_care_need.scheduled_from if p.weekly_care_need else None,
            status=p.status,
            filled_by=p.filled_by,
            resolved_at=p.resolved_at,
            created_at=p.created_at,
            interest_count=len(p.interests),
            weekly_care_need_id=p.weekly_care_need_id,
            care_slots=slot_rows,
            covered_count=sum(bool(row["worker_id"]) for row in slot_rows),
            transition_applied=bool(
                p.weekly_care_need and p.weekly_care_need.activated_at
            ),
        )

    # ── Eligibility (computed on read) ─────────────────────────────────────────

    @staticmethod
    def _parse_snapshot(snapshot) -> list:
        """Inflate the JSON care-need snapshot into objects the domain rules accept."""
        out = []
        for d in snapshot or []:
            out.append(
                SimpleNamespace(
                    day_of_week=WeekDay(d["day_of_week"]),
                    start_time=time.fromisoformat(d["start_time"]),
                    end_time=time.fromisoformat(d["end_time"]),
                    service_type=ServiceType(d["service_type"]),
                )
            )
        return out

    def _funded_covering_end(self, client, today: date, service_type=None):
        """The active authorization's covering end for a funded client. None when
        self-pay, open-ended, or no active authorization — i.e. no hard end date."""
        if client.care_arrangement != CareArrangement.funded:
            return None
        auths = self.auth_repo.list_active_for_client(client.id, self.org_id, today)
        if service_type is not None:
            auths = [
                a
                for a in auths
                if any(s.service_type == service_type for s in a.services)
            ]
        ends = [a.covering_end for a in auths]
        if not ends or any(e is None for e in ends):
            return None
        return max(ends)

    @staticmethod
    def _effective_start(p, today: date) -> date:
        """The date care actually starts when generating/checking — the placement's
        advertised start, never earlier than today (so we never schedule the past)."""
        return max(p.start_date or today, today)

    def _check_horizon(self, client, base_date: date, today: date) -> date:
        """How far ahead to project the plan when checking conflicts/hours — the
        funded end date if sooner, else a one-year cap from the start (matches the
        recurring conflict window used in shift creation)."""
        cap = base_date + timedelta(days=365)
        end = self._funded_covering_end(client, today)
        return end if (end and end < cap) else cap

    def _slot_horizon(self, client, slot, start):
        end = self._funded_covering_end(client, start, slot.service_type)
        cap = start + timedelta(days=365)
        return min(end, cap) if end else cap

    def _eligibility_for(
        self, employment, snapshot_entries, client, effective_start: date, today: date
    ) -> InterestEligibility:
        """Run the same three gates for interested and office-selected workers."""
        avail = self.availability_repo.list_for_person(employment.person_id)
        match = availability_covers_care_need(avail, snapshot_entries)

        blocks = [
            block
            for slot in snapshot_entries
            for block in care_slots_to_time_blocks(
                [slot],
                effective_start,
                self._slot_horizon(client, slot, effective_start),
            )
        ]
        conflicts = self.checker.find_conflicts(employment.id, blocks)
        overtime, cap = self.checker.find_hours_violations(employment.id, blocks)

        availability_ok = match.covered
        no_conflicts = not conflicts
        within_hours = not overtime and not cap

        reasons: list[str] = []
        if not availability_ok:
            if not avail:
                reasons.append("Worker's availability isn't set on their profile")
            else:
                days = ", ".join(
                    _WEEKDAY_LABELS[e.day_of_week] for e in match.uncovered
                )
                reasons.append(
                    f"Availability is set but doesn't cover the care need ({days})"
                )
        if not no_conflicts:
            c = conflicts[0]
            reasons.append(f"Already scheduled: {c['client_name']} on {c['date']}")
        if overtime:
            o = overtime[0]
            reasons.append(
                f"Would exceed the 40h overtime limit ({o['total_hours']}h the week of {o['week_start']})"
            )
        if cap:
            v = cap[0]
            reasons.append(
                f"Would exceed their {v['max_hours']}h/week cap ({v['total_hours']}h the week of {v['week_start']})"
            )

        return InterestEligibility(
            availability_ok=availability_ok,
            no_conflicts=no_conflicts,
            within_hours=within_hours,
            all_clear=availability_ok and no_conflicts and within_hours,
            reasons=reasons,
        )

    # ── Fill-time schedule generation ──────────────────────────────────────────

    @staticmethod
    def _first_occurrence_date(days, start_from: date) -> date:
        """Earliest date on/after start_from whose weekday is one of `days`."""
        wanted = {WEEKDAY_INDEX[d] for d in days}
        d = start_from
        for _ in range(7):
            if d.weekday() in wanted:
                return d
            d += timedelta(days=1)
        return start_from

    def _generate_shifts(
        self,
        placement,
        worker_id,
        snapshot_entries,
        client,
        effective_start: date,
        today: date,
    ) -> list:
        """One recurring shift per (start, end, service) group; BYDAY lists the
        group's weekdays. First occurrence on/after the start date; ends at the
        funded covering_end, else open-ended."""
        location = self._format_address(client)

        groups: dict = {}
        for e in snapshot_entries:
            groups.setdefault((e.start_time, e.end_time, e.service_type), []).append(
                e.day_of_week
            )

        shifts = []
        for (start_t, end_t, service), days in groups.items():
            covering_end = self._funded_covering_end(client, today, service)
            first = self._first_occurrence_date(days, effective_start)
            if covering_end and first > covering_end:
                continue
            byday = ",".join(
                d.value for d in sorted(days, key=lambda x: WEEKDAY_INDEX[x])
            )
            shifts.append(
                Shift(
                    org_id=self.org_id,
                    worker_id=worker_id,
                    client_id=placement.client_id,
                    created_by=self.employment_id,
                    service_type=service,
                    start_time=datetime.combine(first, start_t),
                    end_time=datetime.combine(first, end_t),
                    is_recurring=True,
                    recurrence_rule=f"FREQ=WEEKLY;BYDAY={byday}",
                    recurrence_end_date=covering_end,
                    location=location,
                )
            )
        return shifts

    def _to_detail(self, p) -> PlacementDetailResponse:
        interests = [
            InterestWorkerSummary(
                employment_id=i.employment_id,
                first_name=i.employment.person.first_name,
                last_name=i.employment.person.last_name,
                created_at=i.created_at,
                note=i.note,
                care_slot_ids=i.care_slot_ids,
                eligibility=None,
            )
            for i in p.interests
        ]
        slot_rows = self._slot_rows(p)
        return PlacementDetailResponse(
            id=p.id,
            org_id=p.org_id,
            client_id=p.client_id,
            client_first_name=p.client.first_name,
            client_last_name=p.client.last_name,
            created_by=p.created_by,
            shift_description=p.shift_description,
            requirements=p.requirements,
            masked_location=p.masked_location,
            start_date=p.start_date,
            scheduled_from=p.weekly_care_need.scheduled_from if p.weekly_care_need else None,
            status=p.status,
            filled_by=p.filled_by,
            resolved_at=p.resolved_at,
            created_at=p.created_at,
            interest_count=len(p.interests),
            weekly_care_need_id=p.weekly_care_need_id,
            care_slots=slot_rows,
            covered_count=sum(bool(row["worker_id"]) for row in slot_rows),
            transition_applied=bool(
                p.weekly_care_need and p.weekly_care_need.activated_at
            ),
            interests=interests,
            filled_worker_name=(
                f"{p.filler.person.first_name} {p.filler.person.last_name}"
                if p.filler
                else None
            ),
        )

    def _slot_rows(self, placement):
        assignments = {
            str(a.care_slot_id): a
            for a in self.placement_repo.assignments(placement.id)
        }
        rows = []
        for slot in placement.care_slot_snapshot or []:
            assignment = assignments.get(slot.get("id", ""))
            rows.append(
                {
                    **slot,
                    "worker_id": str(assignment.employment_id) if assignment else None,
                    "worker_name": f"{assignment.employment.person.first_name} {assignment.employment.person.last_name}"
                    if assignment
                    else None,
                }
            )
        return rows

    def _approval_context(self, placement_id, payload):
        org = OrganizationRepository(self.db).lock_by_id(self.org_id)
        placement = self.placement_repo.lock_for_org(placement_id, self.org_id)
        if not placement:
            raise AppError(404, "NOT_FOUND", "Placement not found")
        self._require_open(placement)
        need = placement.weekly_care_need
        if not need:
            raise AppError(
                409,
                "LEGACY_PLACEMENT",
                "Repost the Weekly Care Need to approve individual Care Slots",
            )
        if need.ends_on or (
            not need.activated_at
            and self.care_need_repo.latest(need.client_id).id != need.id
        ):
            raise AppError(
                409, "SUPERSEDED_CARE_NEED", "Review the latest Weekly Care Need"
            )
        now = datetime.now(
            ZoneInfo(org.billing_timezone or "America/St_Johns")
        ).replace(tzinfo=None)
        today = now.date()
        if payload.starts_on < max(
            today, need.effective_from, need.scheduled_from or need.effective_from
        ):
            raise AppError(
                400,
                "PAST_START_DATE",
                "Coverage must start on or after today and the proposed effective date",
            )
        client = self.client_repo.get_active_client(placement.client_id, self.org_id)
        if not client:
            raise AppError(404, "NOT_FOUND", "Client not found")
        if client.status != ClientStatus.active:
            raise AppError(
                409, "CLIENT_NOT_ACTIVE", "Only active clients can receive new coverage"
            )
        slots = {slot.id: slot for slot in need.care_slots}
        covered = {
            a.care_slot_id for a in self.placement_repo.assignments(placement.id)
        }
        selected = [a.care_slot_id for a in payload.selections]
        if (
            not selected
            or len(selected) != len(set(selected))
            or any(i not in slots or i in covered for i in selected)
        ):
            raise AppError(
                409,
                "CARE_SLOT_UNAVAILABLE",
                "Select uncovered Care Slots once each; refresh the placement",
            )
        if payload.starts_on == today and any(
            WEEKDAY_INDEX[slots[key].day_of_week] == today.weekday()
            and slots[key].start_time <= now.time()
            for key in selected
        ):
            raise AppError(
                409,
                "PAST_VISIT_TIME",
                "A selected Care Slot has already started today; choose a later coverage start date",
            )
        by_worker = defaultdict(list)
        for selection in payload.selections:
            interest = self.placement_repo.get_interest(
                placement.id, selection.employment_id
            )
            if (
                not interest
                or str(selection.care_slot_id) not in interest.care_slot_ids
            ):
                raise AppError(
                    409,
                    "WORKER_NOT_INTERESTED",
                    "The worker must express interest in each selected Care Slot",
                )
            by_worker[selection.employment_id].append(slots[selection.care_slot_id])
        previous = (
            self.care_need_repo.get(need.supersedes_id, self.org_id)
            if need.supersedes_id and not need.activated_at
            else None
        )
        old_shifts = (
            self.shift_repo.for_care_need(previous.id, self.org_id) if previous else []
        )
        remaining = [
            slot
            for key, slot in slots.items()
            if key not in covered and key not in selected
        ]
        fingerprint = [
            str(need.id),
            str(payload.starts_on),
            sorted(str(i) for i in covered),
            sorted(
                (str(a.care_slot_id), str(a.employment_id)) for a in payload.selections
            ),
            [
                (
                    str(s.id),
                    str(s.updated_at),
                    str(s.recurrence_end_date),
                    [
                        (str(m.id), str(m.updated_at), str(m.completion_status))
                        for m in s.modifications
                    ],
                )
                for s in old_shifts
            ],
        ]
        token = hashlib.sha256(
            json.dumps(fingerprint, sort_keys=True).encode()
        ).hexdigest()
        return (
            placement,
            need,
            client,
            today,
            by_worker,
            previous,
            old_shifts,
            remaining,
            token,
        )

    def _validate_selected_coverage(self, client, need, by_worker, start, today):
        if client.care_arrangement == CareArrangement.funded:
            compliance = AuthorizationComplianceService(self.db).evaluate_entries(
                client.id, self.org_id, need.care_slots, start
            )
            if any(s.status == "exceeded" for s in compliance.services):
                raise AppError(
                    409,
                    "AUTHORIZATION_EXCEEDED",
                    "The Weekly Care Need exceeds authorization at the selected start date",
                )
        results = []
        for worker_id, slots in by_worker.items():
            worker = self._assignment_worker(worker_id)
            eligibility = self._eligibility_for(worker, slots, client, start, start)
            if not all(
                care_slots_to_time_blocks(
                    [slot], start, self._slot_horizon(client, slot, start)
                )
                for slot in slots
            ):
                raise AppError(
                    409,
                    "NO_SCHEDULE_WINDOW",
                    "A selected Care Slot has no visit before authorization ends",
                )
            results.append(
                {
                    "worker_id": str(worker_id),
                    "worker_name": f"{worker.person.first_name} {worker.person.last_name}",
                    "eligibility": eligibility.model_dump(),
                }
            )
        return results

    @staticmethod
    def _shift_description(shift):
        rule = shift.recurrence_rule or ""
        days = (
            rule.split("BYDAY=")[-1].split(";")[0].split(",")
            if "BYDAY=" in rule
            else []
        )
        labels = (
            ", ".join(_WEEKDAY_LABELS.get(WeekDay(day), day) for day in days)
            if days
            else (
                "Daily" if "FREQ=DAILY" in rule else shift.start_time.strftime("%b %d")
            )
        )
        return f"{labels} · {shift.start_time:%H:%M}–{shift.end_time:%H:%M}"

    def review_approval(self, placement_id, payload):
        try:
            p, need, client, today, by_worker, previous, old, remaining, token = (
                self._approval_context(placement_id, payload)
            )
            # No preview mutation is retained. Eligibility sees the exact proposed cutoff.
            summary = [
                {
                    "shift_id": str(s.id),
                    "worker_name": f"{s.worker.person.first_name} {s.worker.person.last_name}",
                    "start_time": s.start_time.isoformat(),
                    "recurrence_rule": s.recurrence_rule,
                    "description": self._shift_description(s),
                }
                for s in old
            ]
            end_previous_coverage(old, payload.starts_on)
            self.db.flush()
            workers = self._validate_selected_coverage(
                client, need, by_worker, payload.starts_on, today
            )
            return {
                "review_token": token,
                "starts_on": payload.starts_on,
                "ends_previous_schedule": bool(previous),
                "old_shifts": summary,
                "uncovered_slots": [self._slot_to_snapshot(s) for s in remaining],
                "workers": workers,
                "all_clear": all(w["eligibility"]["all_clear"] for w in workers),
            }
        finally:
            self.db.rollback()

    def approve_coverage(self, placement_id, payload):
        try:
            self.cutoff_service.seal_due(self.org_id)
            p, need, client, today, by_worker, previous, old, remaining, token = (
                self._approval_context(placement_id, payload)
            )
            if not payload.review_token or payload.review_token != token:
                raise AppError(
                    409,
                    "APPROVAL_REVIEW_REQUIRED",
                    "The placement changed. Review the schedule before approving",
                )
            if remaining and not payload.accept_uncovered:
                raise AppError(
                    409,
                    "UNCOVERED_SLOTS",
                    "Acknowledge the remaining uncovered Care Slots",
                )
            end_previous_coverage(old, payload.starts_on)
            self.db.flush()
            checks = self._validate_selected_coverage(
                client, need, by_worker, payload.starts_on, today
            )
            if not all(w["eligibility"]["all_clear"] for w in checks):
                raise AppError(
                    409,
                    "WORKER_NOT_ELIGIBLE",
                    "Worker availability or scheduling checks changed; review again",
                    details=checks,
                )
            if not need.activated_at:
                need.activated_at = datetime.now(timezone.utc)
                # Keep the proposed date separately from the approved schedule start.
                need.scheduled_from = payload.starts_on
                if previous:
                    previous.ends_on = payload.starts_on - timedelta(days=1)
                    previous_placement = self.placement_repo.for_care_need(previous.id)
                    if (
                        previous_placement
                        and previous_placement.status == PlacementStatus.open
                    ):
                        self.placement_repo.close(previous_placement)
                        NotificationService(
                            self.db, self.employment_id
                        ).resolve_placement_interest(
                            self.org_id, previous_placement.id, []
                        )
            for worker_id, slots in by_worker.items():
                for slot in slots:
                    self.placement_repo.add_assignment(
                        CareSlotAssignment(
                            care_slot_id=slot.id,
                            placement_id=p.id,
                            employment_id=worker_id,
                            approved_by=self.employment_id,
                            starts_on=payload.starts_on,
                        )
                    )
                    for shift in self._generate_shifts(
                        p,
                        worker_id,
                        [slot],
                        client,
                        payload.starts_on,
                        payload.starts_on,
                    ):
                        shift.weekly_care_need_id, shift.care_slot_id = need.id, slot.id
                        self.shift_repo.add(shift)
            if not remaining:
                p.status = PlacementStatus.filled
                p.resolved_at = datetime.now(timezone.utc)
            self.db.flush()
            NotificationService(self.db, self.employment_id).resolve_placement_interest(
                self.org_id, p.id, [str(s.id) for s in remaining]
            )
            NotificationService(self.db, self.employment_id).notify_coverage_approved(
                self.org_id, p, checks, payload.selections, remaining, payload.starts_on
            )
            self.db.commit()
            return self._to_detail(p)
        except Exception:
            self.db.rollback()
            raise
