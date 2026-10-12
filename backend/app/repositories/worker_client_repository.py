from sqlalchemy.orm import Session

from app.core.enums import ShiftStatus
from app.core.exceptions import AppError
from app.models.client import Client
from app.models.shift import Shift


class WorkerClientRepository:
    def __init__(self, db: Session):
        self.db = db

    def _visible_clients(self, org_id, worker_id):
        # Include clients with retained scheduled care, including past visits. EXISTS avoids duplicate clients for recurring/one-off care.
        own_shift = self.db.query(Shift.id).filter(
            Shift.client_id == Client.id, Shift.org_id == org_id,
            Shift.worker_id == worker_id, Shift.deleted_at.is_(None),
            Shift.status == ShiftStatus.active,
        ).exists()
        return self.db.query(Client).filter(
            Client.org_id == org_id, Client.deleted_at.is_(None),
            own_shift,
        )

    def list_for_worker(self, org_id, worker_id):
        return self._visible_clients(org_id, worker_id).order_by(
            Client.first_name, Client.last_name, Client.id,
        ).all()

    def get_for_worker(self, client_id, org_id, worker_id):
        client = self._visible_clients(org_id, worker_id).filter(Client.id == client_id).first()
        if not client:
            raise AppError(404, "NOT_FOUND", "Client not found")
        return client
