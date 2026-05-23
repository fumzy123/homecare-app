from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.services.client_service import ClientService
from app.services.progress_note_service import ProgressNoteService
from app.core.security import require_admin
from app.core.enums import ClientStatus
from app.schemas.client import ClientCreateSchema, ClientUpdateSchema, ClientResponse
from app.schemas.progress_note import ClientNoteItemResponse

router = APIRouter(prefix="/clients", tags=["Clients"])


def get_client_service(
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
) -> ClientService:
    return ClientService(db, current_user)


def get_progress_note_service(
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
) -> ProgressNoteService:
    return ProgressNoteService(db, current_user)


# ─────────────────────────────────────────
# 1. Create a client
# ─────────────────────────────────────────
@router.post("", response_model=ClientResponse)
async def create_client(
    payload: ClientCreateSchema,
    client_service: ClientService = Depends(get_client_service),
):
    return await client_service.create_client(payload)


# ─────────────────────────────────────────
# 2. List all clients in the admin's org
# Optional filter: ?status=active
# ─────────────────────────────────────────
@router.get("", response_model=List[ClientResponse])
async def get_all_clients(
    status: ClientStatus | None = Query(default=None, description="Filter by status"),
    client_service: ClientService = Depends(get_client_service),
):
    return await client_service.get_all_clients(status)


# ─────────────────────────────────────────
# 3. Get a single client profile
# ─────────────────────────────────────────
@router.get("/{client_id}", response_model=ClientResponse)
async def get_client(
    client_id: str,
    client_service: ClientService = Depends(get_client_service),
):
    return await client_service.get_client(client_id)


# ─────────────────────────────────────────
# 4. Update a client (partial)
# ─────────────────────────────────────────
@router.patch("/{client_id}", response_model=ClientResponse)
async def update_client(
    client_id: str,
    payload: ClientUpdateSchema,
    client_service: ClientService = Depends(get_client_service),
):
    return await client_service.update_client(client_id, payload)


# ─────────────────────────────────────────
# 5. Soft delete a client
# Sets deleted_at — record preserved in DB
# ─────────────────────────────────────────
@router.delete("/{client_id}")
async def delete_client(
    client_id: str,
    client_service: ClientService = Depends(get_client_service),
):
    return await client_service.delete_client(client_id)


# ─────────────────────────────────────────
# 6. List all progress notes for a client
# Joins ProgressNote → Shift → OrgMember
# so callers get worker identity in one shot
# ─────────────────────────────────────────
@router.get("/{client_id}/notes", response_model=List[ClientNoteItemResponse])
async def get_client_notes(
    client_id: str,
    year: int = Query(default=None),
    note_service: ProgressNoteService = Depends(get_progress_note_service),
):
    return await note_service.get_client_notes(client_id, year)
