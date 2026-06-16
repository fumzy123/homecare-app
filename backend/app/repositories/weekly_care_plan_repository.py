from uuid import UUID
from sqlalchemy.orm import Session
from app.models.weekly_care_plan import WeeklyCarePlanEntry


class WeeklyCarePlanRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_for_client(self, client_id: UUID) -> list[WeeklyCarePlanEntry]:
        return (
            self.db.query(WeeklyCarePlanEntry)
            .filter(WeeklyCarePlanEntry.client_id == client_id)
            .order_by(WeeklyCarePlanEntry.day_of_week, WeeklyCarePlanEntry.start_time)
            .all()
        )

    def service_types_by_client(self, client_ids: list[UUID]) -> dict[UUID, set]:
        """Distinct service types present in each client's weekly care plan — the
        source for a client's derived `service_types` (independent of authorizations)."""
        result: dict[UUID, set] = {}
        if not client_ids:
            return result
        rows = (
            self.db.query(WeeklyCarePlanEntry.client_id, WeeklyCarePlanEntry.service_type)
            .filter(WeeklyCarePlanEntry.client_id.in_(client_ids))
            .distinct()
            .all()
        )
        for client_id, service_type in rows:
            result.setdefault(client_id, set()).add(service_type)
        return result

    def replace_for_client(self, client_id: UUID, entries: list[WeeklyCarePlanEntry]) -> list[WeeklyCarePlanEntry]:
        """PUT semantics — the weekly care plan is edited as a whole, so we clear
        the client's existing entries and insert the new set."""
        self.db.query(WeeklyCarePlanEntry).filter(
            WeeklyCarePlanEntry.client_id == client_id
        ).delete(synchronize_session=False)
        for entry in entries:
            self.db.add(entry)
        self.db.flush()
        return entries
