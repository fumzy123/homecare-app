from uuid import UUID
from sqlalchemy.orm import Session
from app.models.care_schedule import CareScheduleBlock


class CareScheduleRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_for_client(self, client_id: UUID) -> list[CareScheduleBlock]:
        return (
            self.db.query(CareScheduleBlock)
            .filter(CareScheduleBlock.client_id == client_id)
            .order_by(CareScheduleBlock.day_of_week, CareScheduleBlock.start_time)
            .all()
        )

    def service_types_by_client(self, client_ids: list[UUID]) -> dict[UUID, set]:
        """Distinct service types present in each client's care plan — the source
        for a client's derived `service_types` (independent of authorizations)."""
        result: dict[UUID, set] = {}
        if not client_ids:
            return result
        rows = (
            self.db.query(CareScheduleBlock.client_id, CareScheduleBlock.service_type)
            .filter(CareScheduleBlock.client_id.in_(client_ids))
            .distinct()
            .all()
        )
        for client_id, service_type in rows:
            result.setdefault(client_id, set()).add(service_type)
        return result

    def replace_for_client(self, client_id: UUID, blocks: list[CareScheduleBlock]) -> list[CareScheduleBlock]:
        """PUT semantics — the care schedule is edited as a whole, so we clear
        the client's existing blocks and insert the new set."""
        self.db.query(CareScheduleBlock).filter(
            CareScheduleBlock.client_id == client_id
        ).delete(synchronize_session=False)
        for block in blocks:
            self.db.add(block)
        self.db.flush()
        return blocks
