from app.domain.workforce import Workforce
from app.domain.client_care import current_care_by_client, directory_care_by_client
from datetime import date, datetime, timezone
from sqlalchemy.orm import Session
from supabase_auth.types import User as SupabaseUser
from app.models.client import Client
from app.schemas.client import ClientCreateSchema, ClientUpdateSchema
from app.core.enums import ClientStatus, ShiftStatus
from app.core.exceptions import AppError
from app.services.org_service import OrgService
from app.services.billing_evidence_service import BillingEvidenceService
from app.services.billing_cutoff_service import BillingCutoffService
from app.repositories.client_repository import ClientRepository
from app.repositories.shift_repository import ShiftRepository
from app.repositories.weekly_care_need_repository import WeeklyCareNeedRepository
import uuid


class ClientService:

    def __init__(self, db: Session, current_user: SupabaseUser):
        self.db = db
        self.current_user = current_user
        self.client_repo = ClientRepository(db)
        self.shift_repo = ShiftRepository(db)
        self.care_need_repo = WeeklyCareNeedRepository(db)
        self.org_id = OrgService.get_user_org_id(current_user, db)
        self.evidence_service = BillingEvidenceService(db, self.org_id)
        self.cutoff_service = BillingCutoffService(db)

    def _attach_one(self, client: Client | None) -> Client | None:
        if client is None:
            return None
        return self._attach_many([client])[0]

    def _attach_many(self, clients: list[Client]) -> list[Client]:
        workforce = Workforce(self.db, self.org_id)
        today = workforce.now.date()
        teams = workforce.care_teams()
        needs = self.care_need_repo.list_for_org(self.org_id)
        current_needs = current_care_by_client(needs, today)
        directory_care = directory_care_by_client(
            needs, self.care_need_repo.assignments_for_org(self.org_id), today,
        )
        for c in clients:
            c.care_team = teams.get(c.id, [])
            c.current_care_need = current_needs.get(c.id)
            c.directory_care = directory_care.get(c.id)
        return clients

    # ─────────────────────────────────────────
    # 1. Create a client
    # ─────────────────────────────────────────
    async def create_client(self, payload: ClientCreateSchema):
        try:
            data = payload.model_dump()
            client = Client(
                id=uuid.uuid4(),
                org_id=self.org_id,
                **data,
            )
            self.client_repo.add(client)
            from app.repositories.activity_repository import ActivityRepository
            ActivityRepository(self.db).record_for_user(self.org_id, self.current_user, f'client:{client.id}', 'clients',
                'Created client profile', f'{client.first_name} {client.last_name}', {'kind': 'client', 'record_id': str(client.id)})
            self.db.commit()
            self.db.refresh(client)
            return self._attach_one(self.client_repo.get_by_id(client.id))

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

            from app.repositories.activity_repository import ActivityRepository
            ActivityRepository(self.db).record_for_user(self.org_id, self.current_user, f'client:{client.id}', 'clients',
                'Updated client profile', f'{client.first_name} {client.last_name}', {'kind': 'client', 'record_id': str(client.id)})
            self.db.commit()
            self.db.refresh(client)
            return self._attach_one(self.client_repo.get_by_id(client.id))

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
            self.cutoff_service.seal_due(self.org_id)
            client = self.client_repo.get_active_client(client_id, self.org_id)
            today = date.today()

            active_shifts = self.shift_repo.get_active_shifts_for_client(client_id, self.org_id)
            for shift in active_shifts:
                self.evidence_service.preserve(shift)
                if shift.is_recurring:
                    shift.recurrence_end_date = today
                    self.shift_repo.delete_modifications_from_date(shift.id, today)
                elif shift.start_time.date() >= today:
                    shift.status = ShiftStatus.cancelled

            client.deleted_at = datetime.now(timezone.utc)
            self.db.commit()
            return {"message": "Client deleted successfully"}

        except AppError:
            self.db.rollback()
            raise
        except Exception as e:
            self.db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))
