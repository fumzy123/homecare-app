from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.schemas.shift import ShiftOccurrenceResponse, WorkerShiftDetailResponse
from app.services.shift_service import ShiftService


router = APIRouter(prefix="/me/shifts", tags=["Worker — Shifts"])


def get_worker_shift_service(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ShiftService:
    return ShiftService(db, current_user)


@router.get("", response_model=list[ShiftOccurrenceResponse])
async def get_my_shifts(
    from_date: date = Query(..., description="Start of date range (YYYY-MM-DD)"),
    to_date: date = Query(..., description="End of date range (YYYY-MM-DD)"),
    shift_service: ShiftService = Depends(get_worker_shift_service),
):
    return await shift_service.get_current_worker_shifts(from_date, to_date)


@router.get("/{shift_id}", response_model=WorkerShiftDetailResponse)
async def get_my_shift_occurrence(
    shift_id: UUID,
    occurrence_date: date = Query(..., description="Occurrence date (YYYY-MM-DD)"),
    shift_service: ShiftService = Depends(get_worker_shift_service),
):
    return await shift_service.get_current_worker_shift_occurrence(
        str(shift_id),
        occurrence_date,
    )
