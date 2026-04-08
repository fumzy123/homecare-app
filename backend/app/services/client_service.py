from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload
from datetime import datetime, timezone
from app.models.client import Client
from app.models.org_member import OrgMember
from app.schemas.client import ClientCreateSchema, ClientUpdateSchema
from app.core.enums import ClientStatus
import uuid


class ClientService:

    @staticmethod
    def _get_admin_org_id(current_user, db: Session) -> str:
        """Resolve the org_id for the currently authenticated admin."""
        admin = db.query(OrgMember).filter(OrgMember.id == current_user.id).first()
        if not admin:
            raise HTTPException(status_code=404, detail="Admin record not found")
        return admin.org_id

    @staticmethod
    def _get_active_client(client_id: str, org_id, db: Session) -> Client:
        """Fetch a non-deleted client that belongs to the admin's org."""
        client = (
            db.query(Client)
            .options(joinedload(Client.assigned_worker))
            .filter(
                Client.id == client_id,
                Client.org_id == org_id,
                Client.deleted_at == None,  # noqa: E711
            )
            .first()
        )
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        return client

    # ─────────────────────────────────────────
    # 1. Create a client
    # ─────────────────────────────────────────
    @staticmethod
    async def create_client(payload: ClientCreateSchema, current_user, db: Session):
        try:
            org_id = ClientService._get_admin_org_id(current_user, db)

            client = Client(
                id=uuid.uuid4(),
                org_id=org_id,
                **payload.model_dump(),
            )
            db.add(client)
            db.commit()
            db.refresh(client)

            # Reload with assigned_worker relationship for response
            return (
                db.query(Client)
                .options(joinedload(Client.assigned_worker))
                .filter(Client.id == client.id)
                .first()
            )

        except HTTPException:
            raise
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=400, detail=str(e))

    # ─────────────────────────────────────────
    # 2. List all clients in the admin's org
    # Optional filter: ?status=active
    # ─────────────────────────────────────────
    @staticmethod
    async def get_all_clients(current_user, db: Session, status: ClientStatus | None = None):
        try:
            org_id = ClientService._get_admin_org_id(current_user, db)

            query = (
                db.query(Client)
                .options(joinedload(Client.assigned_worker))
                .filter(Client.org_id == org_id, Client.deleted_at == None)  # noqa: E711
            )

            if status is not None:
                query = query.filter(Client.status == status)

            return query.all()

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

    # ─────────────────────────────────────────
    # 3. Get a single client
    # Enforces tenant isolation (same org only)
    # ─────────────────────────────────────────
    @staticmethod
    async def get_client(client_id: str, current_user, db: Session):
        try:
            org_id = ClientService._get_admin_org_id(current_user, db)
            return ClientService._get_active_client(client_id, org_id, db)

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

    # ─────────────────────────────────────────
    # 4. Update a client (partial)
    # ─────────────────────────────────────────
    @staticmethod
    async def update_client(client_id: str, payload: ClientUpdateSchema, current_user, db: Session):
        try:
            org_id = ClientService._get_admin_org_id(current_user, db)
            client = ClientService._get_active_client(client_id, org_id, db)

            updates = payload.model_dump(exclude_unset=True)
            for field, value in updates.items():
                setattr(client, field, value)

            db.commit()
            db.refresh(client)

            # Reload with assigned_worker relationship for response
            return (
                db.query(Client)
                .options(joinedload(Client.assigned_worker))
                .filter(Client.id == client.id)
                .first()
            )

        except HTTPException:
            raise
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=400, detail=str(e))

    # ─────────────────────────────────────────
    # 5. Soft delete a client
    # Sets deleted_at — record is preserved
    # ─────────────────────────────────────────
    @staticmethod
    async def delete_client(client_id: str, current_user, db: Session):
        try:
            org_id = ClientService._get_admin_org_id(current_user, db)
            client = ClientService._get_active_client(client_id, org_id, db)

            client.deleted_at = datetime.now(timezone.utc)
            db.commit()

            return {"message": "Client deleted successfully"}

        except HTTPException:
            raise
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=400, detail=str(e))
