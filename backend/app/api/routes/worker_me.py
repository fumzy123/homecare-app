from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import get_current_user
from app.core.exceptions import AppError
from app.models.org_member import OrgMember
from app.schemas.shift import ShiftOccurrenceResponse
from app.schemas.worker_profile import WorkerProfileResponse, WorkerStatsResponse
from app.services.shift_service import ShiftService
from fastapi import Query

router = APIRouter(prefix="/me", tags=["Worker — Me"])


def get_worker_shift_service(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ShiftService:
    return ShiftService(db, current_user)


# ─────────────────────────────────────────
# 1. Get own profile
# ─────────────────────────────────────────
@router.get("/profile", response_model=WorkerProfileResponse)
async def get_my_profile(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    member = db.query(OrgMember).filter(OrgMember.id == current_user.id).first()
    if not member:
        raise AppError(status_code=404, code="NOT_FOUND", message="Profile not found")
    return member


# ─────────────────────────────────────────
# 2. Get own stats (hours this week, streaks)
# ─────────────────────────────────────────
@router.get("/stats", response_model=WorkerStatsResponse)
async def get_my_stats(
    current_user=Depends(get_current_user),
    shift_service: ShiftService = Depends(get_worker_shift_service),
):
    return await shift_service.get_worker_stats(current_user.id)


# ─────────────────────────────────────────
# 3. Get own shifts for a date range
# ─────────────────────────────────────────
@router.get("/shifts", response_model=list[ShiftOccurrenceResponse])
async def get_my_shifts(
    from_date: date = Query(..., description="Start of date range (YYYY-MM-DD)"),
    to_date: date = Query(..., description="End of date range (YYYY-MM-DD)"),
    current_user=Depends(get_current_user),
    shift_service: ShiftService = Depends(get_worker_shift_service),
):
    return await shift_service.get_shifts(from_date, to_date, worker_id=current_user.id)
