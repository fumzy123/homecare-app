from sqlalchemy.orm import Session, selectinload
from app.models.weekly_care_need import WeeklyCareNeed, CareSlot
from app.models.placement import CareSlotAssignment


class WeeklyCareNeedRepository:
    def __init__(self, db: Session):
        self.db = db

    def versions(self, client_id):
        return (
            self.db.query(WeeklyCareNeed)
            .options(selectinload(WeeklyCareNeed.care_slots))
            .filter(WeeklyCareNeed.client_id == client_id)
            .order_by(WeeklyCareNeed.version.desc())
            .all()
        )

    def get(self, need_id, org_id):
        return (
            self.db.query(WeeklyCareNeed)
            .filter(WeeklyCareNeed.id == need_id, WeeklyCareNeed.org_id == org_id)
            .first()
        )

    def latest(self, client_id):
        return (
            self.db.query(WeeklyCareNeed)
            .filter(WeeklyCareNeed.client_id == client_id)
            .order_by(WeeklyCareNeed.version.desc())
            .first()
        )

    def list_for_client(self, client_id):
        need = self.latest(client_id)
        return need.care_slots if need else []

    def list_for_org(self, org_id):
        return (
            self.db.query(WeeklyCareNeed)
            .options(selectinload(WeeklyCareNeed.care_slots))
            .filter(WeeklyCareNeed.org_id == org_id)
            .order_by(WeeklyCareNeed.version.desc())
            .all()
        )

    def add(self, need):
        self.db.add(need)
        self.db.flush()

    def assignments_for_org(self, org_id):
        return (
            self.db.query(CareSlotAssignment)
            .join(CareSlot, CareSlot.id == CareSlotAssignment.care_slot_id)
            .join(WeeklyCareNeed, WeeklyCareNeed.id == CareSlot.weekly_care_need_id)
            .filter(WeeklyCareNeed.org_id == org_id)
            .all()
        )
