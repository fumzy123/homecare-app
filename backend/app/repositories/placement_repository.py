from datetime import datetime, timezone
from uuid import UUID
from sqlalchemy.orm import Session, joinedload
from app.models.placement import Placement, PlacementInterest
from app.models.employment import Employment
from app.core.enums import PlacementStatus


class PlacementRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(
        self,
        org_id: UUID,
        client_id: UUID,
        created_by: UUID,
        shift_description: str,
        masked_location: str,
        requirements: str | None,
        start_date=None,
        care_plan_snapshot: list | None = None,
    ) -> Placement:
        placement = Placement(
            org_id=org_id,
            client_id=client_id,
            created_by=created_by,
            shift_description=shift_description,
            masked_location=masked_location,
            requirements=requirements,
            start_date=start_date,
            care_plan_snapshot=care_plan_snapshot,
            status=PlacementStatus.open,
        )
        self.db.add(placement)
        self.db.flush()
        return placement

    def get_by_id(self, placement_id: UUID) -> Placement | None:
        return (
            self.db.query(Placement)
            .options(
                joinedload(Placement.client),
                joinedload(Placement.interests)
                    .joinedload(PlacementInterest.employment)
                    .joinedload(Employment.person),
            )
            .filter(Placement.id == placement_id)
            .first()
        )

    def list_for_org(self, org_id: UUID, status: PlacementStatus | None = None) -> list[Placement]:
        q = (
            self.db.query(Placement)
            .options(joinedload(Placement.client))
            .filter(Placement.org_id == org_id)
        )
        if status:
            q = q.filter(Placement.status == status)
        return q.order_by(Placement.created_at.desc()).all()

    def fill(self, placement: Placement, employment_id: UUID) -> Placement:
        placement.status = PlacementStatus.filled
        placement.filled_by = employment_id
        placement.resolved_at = datetime.now(timezone.utc)
        self.db.flush()
        return placement

    def close(self, placement: Placement) -> Placement:
        placement.status = PlacementStatus.closed
        placement.resolved_at = datetime.now(timezone.utc)
        self.db.flush()
        return placement

    # ── Interests ─────────────────────────────────────────────────────────────

    def get_interest(self, placement_id: UUID, employment_id: UUID) -> PlacementInterest | None:
        return (
            self.db.query(PlacementInterest)
            .filter(
                PlacementInterest.placement_id == placement_id,
                PlacementInterest.employment_id == employment_id,
            )
            .first()
        )

    def add_interest(
        self, placement_id: UUID, employment_id: UUID, note: str | None
    ) -> PlacementInterest:
        interest = PlacementInterest(
            placement_id=placement_id,
            employment_id=employment_id,
            note=note,
        )
        self.db.add(interest)
        self.db.flush()
        return interest

    def remove_interest(self, interest: PlacementInterest) -> None:
        self.db.delete(interest)
        self.db.flush()
