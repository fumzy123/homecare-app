from uuid import UUID
from sqlalchemy.orm import Session
from app.core.exceptions import AppError
from app.core.enums import PlacementStatus, WeekDay, ServiceType
from app.repositories.placement_repository import PlacementRepository
from app.repositories.organization_repository import OrganizationRepository
from app.repositories.client_repository import ClientRepository
from app.repositories.weekly_care_plan_repository import WeeklyCarePlanRepository
from app.services.notification_service import NotificationService
from app.schemas.placement import (
    PlacementCreateSchema,
    PlacementResponse,
    PlacementDetailResponse,
    WorkerPlacementResponse,
    InterestWorkerSummary,
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

    def fill_placement(self, placement_id: UUID, employment_id: UUID) -> PlacementDetailResponse:
        placement = self._get_or_404(placement_id)
        if placement.status != PlacementStatus.open:
            raise AppError(status_code=400, code="PLACEMENT_NOT_OPEN",
                           message="Placement is no longer open")
        # Only a worker who actually expressed interest can be selected.
        if not self.repo.get_interest(placement_id, employment_id):
            raise AppError(status_code=400, code="WORKER_NOT_INTERESTED",
                           message="That worker has not expressed interest in this placement")

        others = [i.employment_id for i in placement.interests if i.employment_id != employment_id]
        try:
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
        placement = self._get_or_404(placement_id)
        if placement.status != PlacementStatus.open:
            raise AppError(status_code=400, code="PLACEMENT_NOT_OPEN",
                           message="Placement is no longer open")

        interested = [i.employment_id for i in placement.interests]
        try:
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
            status=p.status,
            filled_by=p.filled_by,
            resolved_at=p.resolved_at,
            created_at=p.created_at,
            interest_count=len(p.interests),
        )

    def _to_detail(self, p) -> PlacementDetailResponse:
        interests = [
            InterestWorkerSummary(
                employment_id=i.employment_id,
                first_name=i.employment.person.first_name,
                last_name=i.employment.person.last_name,
                created_at=i.created_at,
                note=i.note,
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
            status=p.status,
            filled_by=p.filled_by,
            resolved_at=p.resolved_at,
            created_at=p.created_at,
            interest_count=len(p.interests),
            interests=interests,
        )
