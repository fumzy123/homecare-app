from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.services.client_service import ClientService
from app.core.security import require_admin
from app.core.enums import ClientStatus
from app.schemas.client import ClientCreateSchema, ClientUpdateSchema, ClientResponse

router = APIRouter()


# ─────────────────────────────────────────
# 1. Create a client
# ─────────────────────────────────────────
@router.post("/", response_model=ClientResponse)
async def create_client(
    payload: ClientCreateSchema,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return await ClientService.create_client(payload, current_user, db)


# ─────────────────────────────────────────
# 2. List all clients in the admin's org
# Optional filter: ?status=active
# ─────────────────────────────────────────
@router.get("/", response_model=List[ClientResponse])
async def get_all_clients(
    status: ClientStatus | None = Query(default=None, description="Filter by status"),
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return await ClientService.get_all_clients(current_user, db, status)


# ─────────────────────────────────────────
# 3. Get a single client profile
# ─────────────────────────────────────────
@router.get("/{client_id}", response_model=ClientResponse)
async def get_client(
    client_id: str,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return await ClientService.get_client(client_id, current_user, db)


# ─────────────────────────────────────────
# 4. Update a client (partial)
# ─────────────────────────────────────────
@router.patch("/{client_id}", response_model=ClientResponse)
async def update_client(
    client_id: str,
    payload: ClientUpdateSchema,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return await ClientService.update_client(client_id, payload, current_user, db)


# ─────────────────────────────────────────
# 5. Soft delete a client
# Sets deleted_at — record preserved in DB
# ─────────────────────────────────────────
@router.delete("/{client_id}")
async def delete_client(
    client_id: str,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return await ClientService.delete_client(client_id, current_user, db)
