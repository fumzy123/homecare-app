from collections import defaultdict
from datetime import date, datetime, timezone
from sqlalchemy.orm import Session
from supabase_auth.types import User as SupabaseUser
from app.models.client import Client
from app.models.organization import Organization
from app.schemas.client import ClientCreateSchema, ClientUpdateSchema
from app.core.enums import ClientStatus, ShiftStatus, AuthorizationCoverage, CareArrangement
from app.core.exceptions import AppError
from app.services.org_service import OrgService
from app.repositories.client_repository import ClientRepository
from app.repositories.shift_repository import ShiftRepository
from app.repositories.authorization_repository import AuthorizationRepository
from app.repositories.weekly_care_plan_repository import WeeklyCarePlanRepository
import uuid


class ClientService:

    def __init__(self, db: Session, current_user: SupabaseUser):
        self.db = db
        self.current_user = current_user
        self.client_repo = ClientRepository(db)
        self.shift_repo = ShiftRepository(db)
        self.auth_repo = AuthorizationRepository(db)
        self.plan_repo = WeeklyCarePlanRepository(db)
        self.org_id = OrgService.get_user_org_id(current_user, db)

    # ── Derived authorization summary (service types, care dates, coverage) ────

    def _derive(
        self, client: Client, auths: list, superseded_ids: set, today: date, plan_service_types: set
    ) -> Client:
        """Attach derived data onto a client instance for the ClientResponse.

        `service_types` come from the client's care plan (what we actually
        deliver), falling back to the active authorization's services when the
        plan is empty. Coverage only means anything for funded clients —
        self-pay clients are never "lapsed"."""
        active = [
            a for a in auths
            if a.cancelled_at is None and a.id not in superseded_ids
            and a.covering_start <= today
            and (a.covering_end is None or a.covering_end >= today)
        ]
        auth_service_types = {s.service_type for a in active for s in a.services}
        client.service_types = sorted(
            plan_service_types or auth_service_types, key=lambda x: x.value
        )
        starts = [a.covering_start for a in auths]
        ends = [a.covering_end for a in auths if a.covering_end]
        client.care_start = min(starts) if starts else None
        client.care_end = max(ends) if ends else None
        client.coverage = (
            AuthorizationCoverage.lapsed
            if client.care_arrangement == CareArrangement.funded
            and client.status == ClientStatus.active and not active
            else AuthorizationCoverage.covered
        )
        return client

    def _attach_one(self, client: Client | None) -> Client | None:
        if client is None:
            return None
        auths = self.auth_repo.list_for_client(client.id, self.org_id)
        superseded = {a.supersedes_id for a in auths if a.supersedes_id}
        plan = self.plan_repo.service_types_by_client([client.id]).get(client.id, set())
        return self._derive(client, auths, superseded, date.today(), plan)

    def _attach_many(self, clients: list[Client]) -> list[Client]:
        all_auths = self.auth_repo.list_for_org(self.org_id)
        by_client: dict = defaultdict(list)
        for a in all_auths:
            by_client[a.client_id].append(a)
        superseded = {a.supersedes_id for a in all_auths if a.supersedes_id}
        plans = self.plan_repo.service_types_by_client([c.id for c in clients])
        today = date.today()
        for c in clients:
            self._derive(c, by_client.get(c.id, []), superseded, today, plans.get(c.id, set()))
        return clients

    # ─────────────────────────────────────────
    # 1. Create a client
    # ─────────────────────────────────────────
    async def create_client(self, payload: ClientCreateSchema):
        try:
            data = payload.model_dump()
            arrangement = data.pop("care_arrangement", None)
            if arrangement is None:
                org = self.db.get(Organization, self.org_id)
                arrangement = (
                    CareArrangement.funded
                    if org is not None and org.uses_authorizations
                    else CareArrangement.self_pay
                )
            client = Client(
                id=uuid.uuid4(),
                org_id=self.org_id,
                care_arrangement=arrangement,
                **data,
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
