from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import require_admin
from app.schemas.shift import (
    CancelFromSchema,
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

router = APIRouter()


# ─────────────────────────────────────────
# 1. Create a single or recurring shift
# ─────────────────────────────────────────
@router.post("/", response_model=ShiftMasterResponse)
async def create_shift(
    payload: ShiftCreateSchema,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return await ShiftService.create_shift(payload, current_user, db)


# ─────────────────────────────────────────
# 2. Get occurrence counts by status (includes cancelled)
# ─────────────────────────────────────────
@router.get("/stats", response_model=ShiftStatsResponse)
async def get_shift_stats(
    from_date: date = Query(..., description="Start of date range (YYYY-MM-DD)"),
    to_date: date = Query(..., description="End of date range (YYYY-MM-DD)"),
    worker_id: str | None = Query(default=None),
    client_id: str | None = Query(default=None),
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return await ShiftService.get_stats(from_date, to_date, current_user, db, worker_id, client_id)


# ─────────────────────────────────────────
# 3. Get expanded occurrences for a date range
# ─────────────────────────────────────────
@router.get("/", response_model=list[ShiftOccurrenceResponse])
async def get_shifts(
    from_date: date = Query(..., description="Start of date range (YYYY-MM-DD)"),
    to_date: date = Query(..., description="End of date range (YYYY-MM-DD)"),
    worker_id: str | None = Query(default=None),
    client_id: str | None = Query(default=None),
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return await ShiftService.get_shifts(from_date, to_date, current_user, db, worker_id, client_id)


# ─────────────────────────────────────────
# 3. Get a single master shift record
# ─────────────────────────────────────────
@router.get("/{shift_id}", response_model=ShiftMasterResponse)
async def get_shift(
    shift_id: str,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return await ShiftService.get_shift(shift_id, current_user, db)


# ─────────────────────────────────────────
# 4. Update master shift
# ─────────────────────────────────────────
@router.patch("/{shift_id}", response_model=ShiftMasterResponse)
async def update_shift(
    shift_id: str,
    payload: ShiftUpdateSchema,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return await ShiftService.update_shift(shift_id, payload, current_user, db)


# ─────────────────────────────────────────
# 5. Cancel entire shift schedule
# ─────────────────────────────────────────
@router.delete("/{shift_id}")
async def cancel_shift(
    shift_id: str,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return await ShiftService.cancel_shift(shift_id, current_user, db)


# ─────────────────────────────────────────
# 6. Create a modification for a specific occurrence
# ─────────────────────────────────────────
@router.post("/{shift_id}/modifications")
async def create_modification(
    shift_id: str,
    payload: ShiftModificationCreateSchema,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return await ShiftService.create_modification(shift_id, payload, current_user, db)


# ─────────────────────────────────────────
# 7. Update an existing modification
# ─────────────────────────────────────────
@router.patch("/{shift_id}/modifications/{original_date}")
async def update_modification(
    shift_id: str,
    original_date: date,
    payload: ShiftModificationUpdateSchema,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return await ShiftService.update_modification(shift_id, original_date, payload, current_user, db)


# ─────────────────────────────────────────
# 8. Cancel this occurrence and all following
# ─────────────────────────────────────────
@router.post("/{shift_id}/cancel-from")
async def cancel_from_date(
    shift_id: str,
    payload: CancelFromSchema,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return await ShiftService.cancel_from_date(shift_id, payload, current_user, db)


# ─────────────────────────────────────────
# 9. Edit this occurrence and all following (splits the series)
# ─────────────────────────────────────────
@router.post("/{shift_id}/edit-from")
async def edit_from_date(
    shift_id: str,
    payload: EditFromSchema,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return await ShiftService.edit_from_date(shift_id, payload, current_user, db)
