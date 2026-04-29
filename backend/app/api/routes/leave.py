from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List
from datetime import date
from app.db.session import get_db
from app.core.security import require_admin
from app.schemas.leave_record import LeaveRecordCreateSchema, LeaveRecordResponse
from app.services.leave_service import LeaveService

router = APIRouter()


@router.get("/{worker_id}/leave", response_model=List[LeaveRecordResponse])
def list_leave_records(
    worker_id: str,
    year: int = Query(default=None),
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    resolved_year = year or date.today().year
    return LeaveService.list_leave_records(worker_id, resolved_year, current_user, db)


@router.post("/{worker_id}/leave", response_model=LeaveRecordResponse, status_code=201)
def create_leave_record(
    worker_id: str,
    payload: LeaveRecordCreateSchema,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return LeaveService.create_leave_record(worker_id, payload, current_user, db)


@router.delete("/{worker_id}/leave/{leave_id}", status_code=204)
def delete_leave_record(
    worker_id: str,
    leave_id: str,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    LeaveService.delete_leave_record(worker_id, leave_id, current_user, db)
