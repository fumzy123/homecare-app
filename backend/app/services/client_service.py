from datetime import datetime, timezone
from sqlalchemy.orm import Session
from supabase_auth.types import User as SupabaseUser
from app.models.client import Client
from app.schemas.client import ClientCreateSchema, ClientUpdateSchema
from app.core.enums import ClientStatus
from app.core.exceptions import AppError
from app.services.org_service import OrgService
from app.repositories.client_repository import ClientRepository
import uuid


class ClientService:

    def __init__(self, db: Session, current_user: SupabaseUser):
        self.db = db
        self.current_user = current_user
        self.client_repo = ClientRepository(db)
        self.org_id = OrgService.get_user_org_id(current_user, db)

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
            return self.client_repo.get_with_worker_by_id(client.id)

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
            return self.client_repo.get_all(self.org_id, status)

        except AppError:
            raise
        except Exception as e:
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 3. Get a single client
    # ─────────────────────────────────────────
    async def get_client(self, client_id: str):
        try:
            return self.client_repo.get_active_client(client_id, self.org_id)

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
            return self.client_repo.get_with_worker_by_id(client.id)

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

            client.deleted_at = datetime.now(timezone.utc)
            self.db.commit()
            return {"message": "Client deleted successfully"}

        except AppError:
            raise
        except Exception as e:
            self.db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))
