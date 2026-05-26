from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import get_current_user
from app.schemas.shift import ShiftOccurrenceResponse
from app.services.shift_service import ShiftService

router = APIRouter(prefix="/me", tags=["Worker — Me"])


def get_worker_shift_service(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ShiftService:
    return ShiftService(db, current_user)


# ─────────────────────────────────────────
# 1. Get own shifts for a date range
# ─────────────────────────────────────────
@router.get("/shifts", response_model=list[ShiftOccurrenceResponse])
async def get_my_shifts(
    from_date: date = Query(..., description="Start of date range (YYYY-MM-DD)"),
    to_date: date = Query(..., description="End of date range (YYYY-MM-DD)"),
    current_user=Depends(get_current_user),
    shift_service: ShiftService = Depends(get_worker_shift_service),
):
    return await shift_service.get_shifts(from_date, to_date, worker_id=current_user.id)
