from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import require_admin
from app.schemas.shift import (
    CancelFromSchema,
    CancelShiftSchema,
    EditFromSchema,
    ShiftCreateSchema,
    ShiftMasterResponse,
    ShiftModificationCreateSchema,
    ShiftModificationUpdateSchema,
    ShiftOccurrenceResponse,
    ShiftStatsResponse,
    ShiftUpdateSchema,
)
from app.services.shift_service import ShiftService

router = APIRouter(prefix="/shifts", tags=["Shifts"])


def get_shift_service(
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
) -> ShiftService:
    return ShiftService(db, current_user)


# ─────────────────────────────────────────
# 1. Create a single or recurring shift
# ─────────────────────────────────────────
@router.post("", response_model=ShiftMasterResponse)
async def create_shift(
    payload: ShiftCreateSchema,
    shift_service: ShiftService = Depends(get_shift_service),
):
    return await shift_service.create_shift(payload)


# ─────────────────────────────────────────
# 2. Get occurrence counts by status (includes cancelled)
# ─────────────────────────────────────────
@router.get("/stats", response_model=ShiftStatsResponse)
async def get_shift_stats(
    from_date: date = Query(..., description="Start of date range (YYYY-MM-DD)"),
    to_date: date = Query(..., description="End of date range (YYYY-MM-DD)"),
    worker_id: str | None = Query(default=None),
    client_id: str | None = Query(default=None),
    shift_service: ShiftService = Depends(get_shift_service),
):
    return await shift_service.get_stats(from_date, to_date, worker_id, client_id)


# ─────────────────────────────────────────
# 3. Get expanded occurrences for a date range
# ─────────────────────────────────────────
@router.get("", response_model=list[ShiftOccurrenceResponse])
async def get_shifts(
    from_date: date = Query(..., description="Start of date range (YYYY-MM-DD)"),
    to_date: date = Query(..., description="End of date range (YYYY-MM-DD)"),
    worker_id: str | None = Query(default=None),
    client_id: str | None = Query(default=None),
    completion_statuses: str | None = Query(default=None, description="Comma-separated statuses to include, e.g. completed,no_show,cancelled"),
    shift_service: ShiftService = Depends(get_shift_service),
):
    parsed_statuses = [s.strip() for s in completion_statuses.split(",")] if completion_statuses else None
    return await shift_service.get_shifts(from_date, to_date, worker_id, client_id, parsed_statuses)


# ─────────────────────────────────────────
# 4. Get a single master shift record
# ─────────────────────────────────────────
@router.get("/{shift_id}", response_model=ShiftMasterResponse)
async def get_shift(
    shift_id: str,
    shift_service: ShiftService = Depends(get_shift_service),
):
    return await shift_service.get_shift(shift_id)


# ─────────────────────────────────────────
# 5. Update master shift
# ─────────────────────────────────────────
@router.patch("/{shift_id}", response_model=ShiftMasterResponse)
async def update_shift(
    shift_id: str,
    payload: ShiftUpdateSchema,
    shift_service: ShiftService = Depends(get_shift_service),
):
    return await shift_service.update_shift(shift_id, payload)


# ─────────────────────────────────────────
# 6. Cancel entire shift schedule
# ─────────────────────────────────────────
@router.post("/{shift_id}/cancel")
async def cancel_shift(
    shift_id: str,
    payload: CancelShiftSchema,
    shift_service: ShiftService = Depends(get_shift_service),
):
    return await shift_service.cancel_shift(shift_id, payload)


# ─────────────────────────────────────────
# 7. Create a modification for a specific occurrence
# ─────────────────────────────────────────
@router.post("/{shift_id}/modifications")
async def create_modification(
    shift_id: str,
    payload: ShiftModificationCreateSchema,
    shift_service: ShiftService = Depends(get_shift_service),
):
    return await shift_service.create_modification(shift_id, payload)


# ─────────────────────────────────────────
# 8. Update an existing modification
# ─────────────────────────────────────────
@router.patch("/{shift_id}/modifications/{original_date}")
async def update_modification(
    shift_id: str,
    original_date: date,
    payload: ShiftModificationUpdateSchema,
    shift_service: ShiftService = Depends(get_shift_service),
):
    return await shift_service.update_modification(shift_id, original_date, payload)


# ─────────────────────────────────────────
# 9. Cancel this occurrence and all following
# ─────────────────────────────────────────
@router.post("/{shift_id}/cancel-from")
async def cancel_from_date(
    shift_id: str,
    payload: CancelFromSchema,
    shift_service: ShiftService = Depends(get_shift_service),
):
    return await shift_service.cancel_from_date(shift_id, payload)


# ─────────────────────────────────────────
# 10. Edit this occurrence and all following (splits the series)
# ─────────────────────────────────────────
@router.post("/{shift_id}/edit-from")
async def edit_from_date(
    shift_id: str,
    payload: EditFromSchema,
    shift_service: ShiftService = Depends(get_shift_service),
):
    return await shift_service.edit_from_date(shift_id, payload)
