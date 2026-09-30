from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.schemas.shift import WorkerShiftDetailResponse
from app.schemas.worker_client import WorkerClientProfile, WorkerClientSummary
from app.services.worker_client_service import WorkerClientService

router = APIRouter(prefix="/me/clients", tags=["Worker — Clients"])


def get_worker_client_service(
    db: Session = Depends(get_db), current_user=Depends(get_current_user),
) -> WorkerClientService:
    return WorkerClientService(db, current_user)


@router.get("", response_model=list[WorkerClientSummary])
def list_my_clients(worker_client_service: WorkerClientService = Depends(get_worker_client_service)):
    return worker_client_service.list_clients()


@router.get("/{client_id}", response_model=WorkerClientProfile)
def get_my_client(client_id: UUID, worker_client_service: WorkerClientService = Depends(get_worker_client_service)):
    return worker_client_service.get_client(client_id)


@router.get("/{client_id}/shifts", response_model=list[WorkerShiftDetailResponse])
def get_my_client_shifts(
    client_id: UUID, from_date: date = Query(...), to_date: date = Query(...),
    worker_client_service: WorkerClientService = Depends(get_worker_client_service),
):
    return worker_client_service.get_client_shifts(client_id, from_date, to_date)
