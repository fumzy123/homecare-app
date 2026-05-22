from sqlalchemy.orm import Session
from datetime import datetime, timezone
from supabase_auth.types import User as SupabaseUser
from app.models.client import Client
from app.schemas.client import ClientCreateSchema, ClientUpdateSchema
from app.core.enums import ClientStatus
from app.core.exceptions import AppError
from app.services.org_service import OrgService
from app.repositories.client_repository import ClientRepository
import uuid


class ClientService:

    # ─────────────────────────────────────────
    # 1. Create a client
    # ─────────────────────────────────────────
    @staticmethod
    async def create_client(payload: ClientCreateSchema, current_user: SupabaseUser, db: Session):
        try:
            repo = ClientRepository(db)
            org_id = OrgService.get_admin_org_id(current_user, db)

            client = Client(
                id=uuid.uuid4(),
                org_id=org_id,
                **payload.model_dump(),
            )
            repo.add(client)
            db.commit()
            db.refresh(client)
            return repo.get_with_worker_by_id(client.id)

        except AppError:
            raise
        except Exception as e:
            db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 2. List all clients in the admin's org
    # ─────────────────────────────────────────
    @staticmethod
    async def get_all_clients(current_user: SupabaseUser, db: Session, status: ClientStatus | None = None):
        try:
            repo = ClientRepository(db)
            org_id = OrgService.get_admin_org_id(current_user, db)
            return repo.get_all(org_id, status)

        except AppError:
            raise
        except Exception as e:
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 3. Get a single client
    # ─────────────────────────────────────────
    @staticmethod
    async def get_client(client_id: str, current_user: SupabaseUser, db: Session):
        try:
            repo = ClientRepository(db)
            org_id = OrgService.get_admin_org_id(current_user, db)
            return repo.get_active_client(client_id, org_id)

        except AppError:
            raise
        except Exception as e:
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 4. Update a client (partial)
    # ─────────────────────────────────────────
    @staticmethod
    async def update_client(client_id: str, payload: ClientUpdateSchema, current_user: SupabaseUser, db: Session):
        try:
            repo = ClientRepository(db)
            org_id = OrgService.get_admin_org_id(current_user, db)
            client = repo.get_active_client(client_id, org_id)

            updates = payload.model_dump(exclude_unset=True)
            for field, value in updates.items():
                setattr(client, field, value)

            db.commit()
            db.refresh(client)
            return repo.get_with_worker_by_id(client.id)

        except AppError:
            raise
        except Exception as e:
            db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 5. Soft delete a client
    # ─────────────────────────────────────────
    @staticmethod
    async def delete_client(client_id: str, current_user: SupabaseUser, db: Session):
        try:
            repo = ClientRepository(db)
            org_id = OrgService.get_admin_org_id(current_user, db)
            client = repo.get_active_client(client_id, org_id)

            client.deleted_at = datetime.now(timezone.utc)
            db.commit()
            return {"message": "Client deleted successfully"}

        except AppError:
            raise
        except Exception as e:
            db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))
