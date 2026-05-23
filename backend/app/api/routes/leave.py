from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List
from datetime import date
from app.db.session import get_db
from app.core.security import require_admin
from app.schemas.leave_record import LeaveRecordCreateSchema, LeaveRecordResponse
from app.services.leave_service import LeaveService

router = APIRouter(prefix="/org-members", tags=["Leave"])


def get_leave_service(
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
) -> LeaveService:
    return LeaveService(db, current_user)


@router.get("/{worker_id}/leave", response_model=List[LeaveRecordResponse])
def list_leave_records(
    worker_id: str,
    year: int = Query(default=None),
    leave_service: LeaveService = Depends(get_leave_service),
):
    resolved_year = year or date.today().year
    return leave_service.list_leave_records(worker_id, resolved_year)


@router.post("/{worker_id}/leave", response_model=LeaveRecordResponse, status_code=201)
def create_leave_record(
    worker_id: str,
    payload: LeaveRecordCreateSchema,
    leave_service: LeaveService = Depends(get_leave_service),
):
    return leave_service.create_leave_record(worker_id, payload)


@router.delete("/{worker_id}/leave/{leave_id}", status_code=204)
def delete_leave_record(
    worker_id: str,
    leave_id: str,
    leave_service: LeaveService = Depends(get_leave_service),
):
    leave_service.delete_leave_record(worker_id, leave_id)
