from datetime import date, datetime, time, timedelta
from types import SimpleNamespace
from uuid import UUID
from sqlalchemy.orm import Session
from app.core.exceptions import AppError
from app.core.enums import PlacementStatus, WeekDay, ServiceType, CareArrangement
from app.models.shift import Shift
from app.repositories.placement_repository import PlacementRepository
from app.repositories.organization_repository import OrganizationRepository
from app.repositories.client_repository import ClientRepository
from app.repositories.weekly_care_plan_repository import WeeklyCarePlanRepository
from app.repositories.worker_availability_repository import WorkerAvailabilityRepository
from app.repositories.authorization_repository import AuthorizationRepository
from app.repositories.shift_repository import ShiftRepository
from app.domain.scheduling import SchedulingChecker, weekly_entries_to_time_blocks, WEEKDAY_INDEX
from app.domain.availability import availability_covers_care_plan
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

# Labels used to render the care-plan snapshot text frozen onto a placement.
_WEEKDAY_LABELS = {
    WeekDay.MO: "Mon", WeekDay.TU: "Tue", WeekDay.WE: "Wed", WeekDay.TH: "Thu",
    WeekDay.FR: "Fri", WeekDay.SA: "Sat", WeekDay.SU: "Sun",
}
_WEEKDAY_ORDER = {d: i for i, d in enumerate(
    [WeekDay.MO, WeekDay.TU, WeekDay.WE, WeekDay.TH, WeekDay.FR, WeekDay.SA, WeekDay.SU]
)}
_SERVICE_LABELS = {
    ServiceType.personal_care: "Personal Care",
    ServiceType.companionship: "Companionship",
    ServiceType.respite:       "Respite",
    ServiceType.nursing:       "Nursing",
    ServiceType.homemaking:    "Homemaking",
}


class PlacementService:
    def __init__(self, db: Session, current_user, org_id: UUID):
        self.db = db
        self.current_user = current_user
        self.org_id = org_id
        self.repo = PlacementRepository(db)
        self.client_repo = ClientRepository(db)
        self.plan_repo = WeeklyCarePlanRepository(db)
        self.availability_repo = WorkerAvailabilityRepository(db)
        self.auth_repo = AuthorizationRepository(db)
        self.shift_repo = ShiftRepository(db)
        self.cutoff_service = BillingCutoffService(db)
        self.checker = SchedulingChecker(db, org_id)
        employment = OrganizationRepository(db).get_active_employment_for_user(current_user.id)
        if not employment:
            raise AppError(status_code=404, code="NOT_FOUND", message="Member record not found")
        self.employment_id = employment.id

    # ── Admin actions ─────────────────────────────────────────────────────────

    def create_placement(self, payload: PlacementCreateSchema) -> PlacementDetailResponse:
        # The address and weekly care plan are snapshotted from the client now,
        # so the opportunity a worker sees stays exactly what was advertised even
        # if the client's plan or address later changes.
        client = self.client_repo.get_active_client(payload.client_id, self.org_id)
        if not client:
            raise AppError(status_code=404, code="NOT_FOUND", message="Client not found")
        location = self._format_address(client)
        entries = self.plan_repo.list_for_client(payload.client_id)
        care_plan = self._format_care_plan(entries)
        snapshot = [self._entry_to_snapshot(e) for e in entries]

        try:
            placement = self.repo.create(
                org_id=self.org_id,
                client_id=payload.client_id,
                created_by=self.employment_id,
                shift_description=care_plan,
                masked_location=location,
                requirements=payload.requirements,
                start_date=payload.start_date,
                care_plan_snapshot=snapshot,
            )

            # Notify all workers in the same transaction: if the fan-out fails,
            # the placement is rolled back rather than left orphaned.
            notification_svc = NotificationService(self.db, current_user_id=self.employment_id)
            notification_svc.notify_placement_created(
                org_id=self.org_id,
                placement_id=placement.id,
                admin_id=self.employment_id,
                client_id=payload.client_id,
                client_name=f"{client.first_name} {client.last_name}",
                masked_location=location,
                shift_description=care_plan,
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
    def _entry_to_snapshot(e) -> dict:
        """Serialize one care-plan entry for the frozen JSON snapshot."""
        return {
            "day_of_week":  e.day_of_week.value,
            "start_time":   e.start_time.isoformat(),
            "end_time":     e.end_time.isoformat(),
            "service_type": e.service_type.value,
        }

    def _format_care_plan(self, entries) -> str:
        """Render the client's weekly care plan as a frozen text block, e.g.
        "Mon · 9am–7pm · Personal Care"."""
        if not entries:
            return "No weekly care plan has been set for this client yet."
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

    def list_placements(self, status: PlacementStatus | None = None) -> list[PlacementResponse]:
        placements = self.repo.list_for_org(self.org_id, status)
        return [self._to_response(p) for p in placements]

    def get_placement(self, placement_id: UUID) -> PlacementDetailResponse:
        placement = self._get_or_404(placement_id)
        return self._to_detail(placement)

    def preview_assignment(self, placement_id: UUID, employment_id: UUID):
        placement = self._get_or_404(placement_id)
        self._require_open(placement)
        worker = self._assignment_worker(employment_id)
        client, entries, today, start = self._assignment_context(placement)
        return dict(employment_id=worker.id,
                    worker_name=f"{worker.person.first_name} {worker.person.last_name}",
                    eligibility=self._eligibility_for(worker, entries, client, start, today))

    def assign_worker(self, placement_id: UUID, employment_id: UUID):
        return self._assign(placement_id, employment_id, require_interest=False)

    def fill_placement(self, placement_id: UUID, employment_id: UUID):
        return self._assign(placement_id, employment_id, require_interest=True)

    @staticmethod
    def _require_open(placement):
        if placement.status != PlacementStatus.open:
            raise AppError(409, "PLACEMENT_NOT_OPEN", "Placement is no longer open")

    def _assignment_worker(self, employment_id):
        worker = self.repo.active_worker(employment_id, self.org_id)
        if not worker:
            raise AppError(404, "WORKER_NOT_AVAILABLE", "An active worker in this agency is required")
        return worker

    def _assignment_context(self, placement):
        client = self.client_repo.get_active_client(placement.client_id, self.org_id)
        if not client:
            raise AppError(404, "NOT_FOUND", "Client not found")
        entries = self._parse_snapshot(placement.care_plan_snapshot)
        if not entries:
            raise AppError(400, "NO_CARE_PLAN", "This placement has no weekly care plan to schedule")
        for index, entry in enumerate(entries):
            if entry.end_time <= entry.start_time or any(
                entry.day_of_week == other.day_of_week
                and entry.start_time < other.end_time and other.start_time < entry.end_time
                for other in entries[:index]
            ):
                raise AppError(409, "INVALID_CARE_PLAN", "The saved care plan contains invalid or overlapping times; close and repost it with a corrected plan")
        today = date.today()
        start = self._effective_start(placement, today)
        horizon = self._check_horizon(client, start, today)
        if not weekly_entries_to_time_blocks(entries, start, horizon):
            raise AppError(409, "NO_SCHEDULE_WINDOW", "No care-plan visits fall within the scheduling window")
        return client, entries, today, start

    def _assign(self, placement_id, employment_id, *, require_interest):
        try:
            # Same agency-first lock order as ShiftService: competing placements
            # and ordinary scheduling writes cannot pass checks simultaneously.
            self.cutoff_service.seal_due(self.org_id)
            placement = self.repo.lock_for_org(placement_id, self.org_id)
            if not placement:
                raise AppError(404, "NOT_FOUND", "Placement not found")
            self._require_open(placement)
            if require_interest and not any(i.employment_id == employment_id for i in placement.interests):
                raise AppError(400, "WORKER_NOT_INTERESTED", "That worker has not expressed interest in this placement")
            worker = self._assignment_worker(employment_id)
            client, entries, today, start = self._assignment_context(placement)
            eligibility = self._eligibility_for(worker, entries, client, start, today)
            if not eligibility.all_clear:
                raise AppError(409, "WORKER_NOT_ELIGIBLE", "Worker can't be assigned: " + "; ".join(eligibility.reasons),
                               details=eligibility.reasons)
            shifts = self._generate_shifts(placement, employment_id, entries, client, start, today)
            others = [i.employment_id for i in placement.interests if i.employment_id != employment_id]
            for shift in shifts:
                self.shift_repo.add(shift)
            self.repo.fill(placement, employment_id)

            notification_svc = NotificationService(self.db, current_user_id=self.employment_id)
            # Tell the selected worker they were chosen.
            notification_svc.notify_placement_filled(
                org_id=self.org_id,
                placement_id=placement.id,
                masked_location=placement.masked_location,
                chosen_worker_id=employment_id,
                triggered_by_id=self.employment_id,
                commit=False,
            )
            # Tell everyone else the placement is no longer available.
            notification_svc.notify_placement_closed(
                org_id=self.org_id,
                placement_id=placement.id,
                masked_location=placement.masked_location,
                recipient_ids=others,
                triggered_by_id=self.employment_id,
                commit=False,
            )

            self.db.commit()
        except Exception:
            self.db.rollback()
            raise
        self.db.refresh(placement)
        return self._to_detail(placement)

    def close_placement(self, placement_id: UUID) -> PlacementDetailResponse:
        try:
            OrganizationRepository(self.db).lock_by_id(self.org_id)
            placement = self.repo.lock_for_org(placement_id, self.org_id)
            if not placement:
                raise AppError(404, "NOT_FOUND", "Placement not found")
            self._require_open(placement)
            interested = [i.employment_id for i in placement.interests]
            self.repo.close(placement)

            # Tell interested workers the placement is no longer available.
            notification_svc = NotificationService(self.db, current_user_id=self.employment_id)
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
        placement = self.repo.get_by_id(placement_id)
        if not placement or placement.org_id != self.org_id:
            raise AppError(status_code=404, code="NOT_FOUND", message="Placement not found")
        has_interest = bool(self.repo.get_interest(placement_id, self.employment_id))
        return WorkerPlacementResponse(
            id=placement.id,
            status=placement.status,
            client_first_name=placement.client.first_name,
            client_last_name=placement.client.last_name,
            masked_location=placement.masked_location,
            shift_description=placement.shift_description,
            requirements=placement.requirements,
            start_date=placement.start_date,
            created_at=placement.created_at,
            has_interest=has_interest,
        )

    def express_interest(
        self, placement_id: UUID, employment_id: UUID, note: str | None
    ) -> None:
        placement = self._get_or_404(placement_id)
        if placement.status != PlacementStatus.open:
            raise AppError(status_code=400, code="PLACEMENT_NOT_OPEN",
                           message="This placement is no longer accepting interest")
        existing = self.repo.get_interest(placement_id, employment_id)
        if existing:
            raise AppError(status_code=409, code="ALREADY_INTERESTED",
                           message="You have already expressed interest in this placement")
        self.repo.add_interest(placement_id, employment_id, note)
        self.db.commit()

    def withdraw_interest(self, placement_id: UUID, employment_id: UUID) -> None:
        interest = self.repo.get_interest(placement_id, employment_id)
        if not interest:
            raise AppError(status_code=404, code="NOT_FOUND",
                           message="No interest record found")
        self.repo.remove_interest(interest)
        self.db.commit()

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _get_or_404(self, placement_id: UUID):
        placement = self.repo.get_by_id(placement_id)
        if not placement or placement.org_id != self.org_id:
            raise AppError(status_code=404, code="NOT_FOUND", message="Placement not found")
        return placement

    def _to_response(self, p) -> PlacementResponse:
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
            status=p.status,
            filled_by=p.filled_by,
            resolved_at=p.resolved_at,
            created_at=p.created_at,
            interest_count=len(p.interests),
        )

    # ── Eligibility (computed on read) ─────────────────────────────────────────

    @staticmethod
    def _parse_snapshot(snapshot) -> list:
        """Inflate the JSON care-plan snapshot into objects the domain rules accept."""
        out = []
        for d in snapshot or []:
            out.append(SimpleNamespace(
                day_of_week=WeekDay(d["day_of_week"]),
                start_time=time.fromisoformat(d["start_time"]),
                end_time=time.fromisoformat(d["end_time"]),
                service_type=ServiceType(d["service_type"]),
            ))
        return out

    def _funded_covering_end(self, client, today: date):
        """The active authorization's covering end for a funded client. None when
        self-pay, open-ended, or no active authorization — i.e. no hard end date."""
        if client.care_arrangement != CareArrangement.funded:
            return None
        auths = self.auth_repo.list_active_for_client(client.id, self.org_id, today)
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

    def _eligibility_for(self, employment, snapshot_entries, client, effective_start: date, today: date) -> InterestEligibility:
        """Run the same three gates for interested and office-selected workers."""
        avail = self.availability_repo.list_for_person(employment.person_id)
        match = availability_covers_care_plan(avail, snapshot_entries)

        blocks = weekly_entries_to_time_blocks(snapshot_entries, effective_start, self._check_horizon(client, effective_start, today))
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
                days = ", ".join(_WEEKDAY_LABELS[e.day_of_week] for e in match.uncovered)
                reasons.append(f"Availability is set but doesn't cover the care plan ({days})")
        if not no_conflicts:
            c = conflicts[0]
            reasons.append(f"Already scheduled: {c['client_name']} on {c['date']}")
        if overtime:
            o = overtime[0]
            reasons.append(f"Would exceed the 40h overtime limit ({o['total_hours']}h the week of {o['week_start']})")
        if cap:
            v = cap[0]
            reasons.append(f"Would exceed their {v['max_hours']}h/week cap ({v['total_hours']}h the week of {v['week_start']})")

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

    def _generate_shifts(self, placement, worker_id, snapshot_entries, client, effective_start: date, today: date) -> list:
        """One recurring shift per (start, end, service) group; BYDAY lists the
        group's weekdays. First occurrence on/after the start date; ends at the
        funded covering_end, else open-ended."""
        covering_end = self._funded_covering_end(client, today)
        location = self._format_address(client)

        groups: dict = {}
        for e in snapshot_entries:
            groups.setdefault((e.start_time, e.end_time, e.service_type), []).append(e.day_of_week)

        shifts = []
        for (start_t, end_t, service), days in groups.items():
            first = self._first_occurrence_date(days, effective_start)
            if covering_end and first > covering_end:
                continue
            byday = ",".join(d.value for d in sorted(days, key=lambda x: WEEKDAY_INDEX[x]))
            shifts.append(Shift(
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
            ))
        return shifts

    def _to_detail(self, p) -> PlacementDetailResponse:
        # Eligibility is a pre-assignment decision aid — only meaningful while the
        # placement is open. Once filled/closed the question is settled (and the
        # generated shifts would otherwise show up as "conflicts"), so skip it.
        snapshot_entries = self._parse_snapshot(p.care_plan_snapshot)
        today = date.today()
        show_eligibility = p.status == PlacementStatus.open and bool(snapshot_entries)
        effective_start = self._effective_start(p, today)
        interests = [
            InterestWorkerSummary(
                employment_id=i.employment_id,
                first_name=i.employment.person.first_name,
                last_name=i.employment.person.last_name,
                created_at=i.created_at,
                note=i.note,
                eligibility=(
                    self._eligibility_for(i.employment, snapshot_entries, p.client, effective_start, today)
                    if show_eligibility else None
                ),
            )
            for i in p.interests
        ]
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
            status=p.status,
            filled_by=p.filled_by,
            resolved_at=p.resolved_at,
            created_at=p.created_at,
            interest_count=len(p.interests),
            interests=interests,
            filled_worker_name=(f"{p.filler.person.first_name} {p.filler.person.last_name}" if p.filler else None),
        )
