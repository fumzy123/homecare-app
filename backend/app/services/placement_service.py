from uuid import UUID
from sqlalchemy.orm import Session
from app.core.exceptions import AppError
from app.core.enums import PlacementStatus
from app.repositories.placement_repository import PlacementRepository
from app.repositories.organization_repository import OrganizationRepository
from app.services.notification_service import NotificationService
from app.schemas.placement import (
    PlacementCreateSchema,
    PlacementResponse,
    PlacementDetailResponse,
    WorkerPlacementResponse,
    InterestWorkerSummary,
)


class PlacementService:
    def __init__(self, db: Session, current_user, org_id: UUID):
        self.db = db
        self.current_user = current_user
        self.org_id = org_id
        self.repo = PlacementRepository(db)
        employment = OrganizationRepository(db).get_active_employment_for_user(current_user.id)
        if not employment:
            raise AppError(status_code=404, code="NOT_FOUND", message="Member record not found")
        self.employment_id = employment.id

    # ── Admin actions ─────────────────────────────────────────────────────────

    def create_placement(self, payload: PlacementCreateSchema) -> PlacementDetailResponse:
        placement = self.repo.create(
            org_id=self.org_id,
            client_id=payload.client_id,
            created_by=self.employment_id,
            shift_description=payload.shift_description,
            masked_location=payload.masked_location,
            requirements=payload.requirements,
        )
        self.db.commit()
        self.db.refresh(placement)

        # Notify all workers
        notification_svc = NotificationService(self.db, current_user_id=self.employment_id)
        notification_svc.notify_placement_created(
            org_id=self.org_id,
            placement_id=placement.id,
            admin_id=self.employment_id,
            client_id=payload.client_id,
            masked_location=payload.masked_location,
            shift_description=payload.shift_description,
            requirements=payload.requirements,
        )

        return self._to_detail(placement)

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
        self.repo.fill(placement, employment_id)
        self.db.commit()
        self.db.refresh(placement)
        return self._to_detail(placement)

    def close_placement(self, placement_id: UUID) -> PlacementDetailResponse:
        placement = self._get_or_404(placement_id)
        if placement.status != PlacementStatus.open:
            raise AppError(status_code=400, code="PLACEMENT_NOT_OPEN",
                           message="Placement is no longer open")
        self.repo.close(placement)
        self.db.commit()
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
