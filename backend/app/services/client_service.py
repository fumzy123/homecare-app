from collections import defaultdict
from datetime import date, datetime, timezone
from sqlalchemy.orm import Session
from supabase_auth.types import User as SupabaseUser
from app.models.client import Client
from app.schemas.client import ClientCreateSchema, ClientUpdateSchema
from app.core.enums import ClientStatus, ShiftStatus, AuthorizationCoverage
from app.core.exceptions import AppError
from app.services.org_service import OrgService
from app.repositories.client_repository import ClientRepository
from app.repositories.shift_repository import ShiftRepository
from app.repositories.authorization_repository import AuthorizationRepository
import uuid


class ClientService:

    def __init__(self, db: Session, current_user: SupabaseUser):
        self.db = db
        self.current_user = current_user
        self.client_repo = ClientRepository(db)
        self.shift_repo = ShiftRepository(db)
        self.auth_repo = AuthorizationRepository(db)
        self.org_id = OrgService.get_user_org_id(current_user, db)

    # ── Derived authorization summary (service types, care dates, coverage) ────

    def _derive(self, client: Client, auths: list, superseded_ids: set, today: date) -> Client:
        """Attach derived authorization data onto a client instance so the
        ClientResponse can surface it. Care dates and service types now live on
        authorizations, not the client."""
        active = [
            a for a in auths
            if a.cancelled_at is None and a.id not in superseded_ids
            and a.covering_start <= today
            and (a.covering_end is None or a.covering_end >= today)
        ]
        client.service_types = sorted(
            {s.service_type for a in active for s in a.services}, key=lambda x: x.value
        )
        starts = [a.covering_start for a in auths]
        ends = [a.covering_end for a in auths if a.covering_end]
        client.care_start = min(starts) if starts else None
        client.care_end = max(ends) if ends else None
        client.coverage = (
            AuthorizationCoverage.lapsed
            if client.status == ClientStatus.active and not active
            else AuthorizationCoverage.covered
        )
        return client

    def _attach_one(self, client: Client | None) -> Client | None:
        if client is None:
            return None
        auths = self.auth_repo.list_for_client(client.id, self.org_id)
        superseded = {a.supersedes_id for a in auths if a.supersedes_id}
        return self._derive(client, auths, superseded, date.today())

    def _attach_many(self, clients: list[Client]) -> list[Client]:
        all_auths = self.auth_repo.list_for_org(self.org_id)
        by_client: dict = defaultdict(list)
        for a in all_auths:
            by_client[a.client_id].append(a)
        superseded = {a.supersedes_id for a in all_auths if a.supersedes_id}
        today = date.today()
        for c in clients:
            self._derive(c, by_client.get(c.id, []), superseded, today)
        return clients

    # ─────────────────────────────────────────
    # 1. Create a client
    # ─────────────────────────────────────────
    async def create_client(self, payload: ClientCreateSchema):
        try:
            client = Client(
                id=uuid.uuid4(),
                org_id=self.org_id,
                **payload.model_dump(),
            )
            self.client_repo.add(client)
            self.db.commit()
            self.db.refresh(client)
            return self._attach_one(self.client_repo.get_with_worker_by_id(client.id))

        except AppError:
            raise
        except Exception as e:
            self.db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 2. List all clients in the admin's org
    # ─────────────────────────────────────────
    async def get_all_clients(self, status: ClientStatus | None = None):
        try:
            return self._attach_many(self.client_repo.get_all(self.org_id, status))

        except AppError:
            raise
        except Exception as e:
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 3. Get a single client
    # ─────────────────────────────────────────
    async def get_client(self, client_id: str):
        try:
            return self._attach_one(self.client_repo.get_active_client(client_id, self.org_id))

        except AppError:
            raise
        except Exception as e:
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 4. Update a client (partial)
    # ─────────────────────────────────────────
    async def update_client(self, client_id: str, payload: ClientUpdateSchema):
        try:
            client = self.client_repo.get_active_client(client_id, self.org_id)

            updates = payload.model_dump(exclude_unset=True)
            for field, value in updates.items():
                setattr(client, field, value)

            self.db.commit()
            self.db.refresh(client)
            return self._attach_one(self.client_repo.get_with_worker_by_id(client.id))

        except AppError:
            raise
        except Exception as e:
            self.db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 5. Soft delete a client
    # ─────────────────────────────────────────
    async def delete_client(self, client_id: str):
        try:
            client = self.client_repo.get_active_client(client_id, self.org_id)
            today = date.today()

            active_shifts = self.shift_repo.get_active_shifts_for_client(client_id, self.org_id)
            for shift in active_shifts:
                if shift.is_recurring:
                    shift.recurrence_end_date = today
                    self.shift_repo.delete_modifications_from_date(shift.id, today)
                elif shift.start_time.date() >= today:
                    shift.status = ShiftStatus.cancelled

            client.deleted_at = datetime.now(timezone.utc)
            self.db.commit()
            return {"message": "Client deleted successfully"}

        except AppError:
            raise
        except Exception as e:
            self.db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))
