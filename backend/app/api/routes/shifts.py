from datetime import date, datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import require_admin
from app.core.exceptions import AppError
from app.core.enums import NotificationType
from app.repositories.organization_repository import OrganizationRepository
from app.schemas.shift import (
    ShiftCancelFromSchema,
    ShiftCancelSchema,
    ShiftEditFromSchema,
    ShiftCreateSchema,
    ShiftMasterResponse,
    ShiftModificationCreateSchema,
    ShiftModificationUpdateSchema,
    ShiftOccurrenceResponse,
    ShiftStatsResponse,
    CareMetricsResponse,
    ShiftUpdateSchema,
    OvertimeApprovalRequestSchema,
    OvertimeApproveSchema,
    OvertimeRejectSchema,
    RecurrenceSchema,
)
from app.services.shift_service import ShiftService
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/shifts", tags=["Shifts"])


def get_shift_service(
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
) -> ShiftService:
    return ShiftService(db, current_user)


def get_notification_service(
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
) -> NotificationService:
    employment = OrganizationRepository(db).get_active_employment_for_user(current_user.id)
    if not employment:
        raise AppError(status_code=404, code="NOT_FOUND", message="Member record not found")
    return NotificationService(db, current_user_id=employment.id)


# ─────────────────────────────────────────
# 0. Request overtime approval from a manager
# ─────────────────────────────────────────
@router.post("/request-overtime-approval")
async def request_overtime_approval(
    payload: OvertimeApprovalRequestSchema,
    shift_service: ShiftService = Depends(get_shift_service),
    notification_service: NotificationService = Depends(get_notification_service),
):
    notification_service.notify_overtime_approval_requested(
        org_id=shift_service.org_id,
        requesting_member_id=shift_service.current_employment_id,
        requesting_member_name=f"{shift_service.current_employment.person.first_name} {shift_service.current_employment.person.last_name}",
        worker_id=payload.worker_id,
        week_start=payload.week_start,
        week_end=payload.week_end,
        total_hours=payload.total_hours,
        client_id=payload.client_id,
        client_name=payload.client_name,
        start_time=payload.start_time.isoformat() if payload.start_time else None,
        end_time=payload.end_time.isoformat() if payload.end_time else None,
        is_recurring=payload.is_recurring,
        recurrence=payload.recurrence.model_dump() if payload.recurrence else None,
        note=payload.note,
    )
    return {"ok": True}


# ─────────────────────────────────────────
# 0a. Approve an overtime request
# ─────────────────────────────────────────
@router.post("/approve-overtime", response_model=ShiftMasterResponse)
async def approve_overtime(
    payload: OvertimeApproveSchema,
    shift_service: ShiftService = Depends(get_shift_service),
    notification_service: NotificationService = Depends(get_notification_service),
):
    notification = notification_service.get_notification(payload.notification_id)
    if notification.type != NotificationType.overtime_approval_requested:
        raise AppError(status_code=400, code="INVALID_NOTIFICATION_TYPE", message="Not an overtime approval request")

    p = notification.payload
    if not p.get("client_id") or not p.get("start_time") or not p.get("end_time"):
        raise AppError(status_code=400, code="INCOMPLETE_SHIFT_CONTEXT", message="Notification missing shift details — approve by editing the shift directly")

    # Manager's recurrence edit takes precedence over the notification payload
    if payload.is_recurring is not None:
        recurrence = payload.recurrence if payload.is_recurring else None
    else:
        recurrence = RecurrenceSchema(**p["recurrence"]) if p.get("is_recurring") and p.get("recurrence") else None

    shift_payload = ShiftCreateSchema(
        worker_id=notification.worker_id,
        client_id=p["client_id"],
        start_time=payload.start_time or datetime.fromisoformat(p["start_time"]),
        end_time=payload.end_time or datetime.fromisoformat(p["end_time"]),
        recurrence=recurrence,
        override_hours_check=True,
    )
    result = await shift_service.create_shift(shift_payload)
    notification_service.mark_resolved(payload.notification_id)
    return result


# ─────────────────────────────────────────
# 0b. Reject an overtime request
# ─────────────────────────────────────────
@router.post("/reject-overtime")
async def reject_overtime(
    payload: OvertimeRejectSchema,
    notification_service: NotificationService = Depends(get_notification_service),
):
    notification = notification_service.get_notification(payload.notification_id)
    if notification.type != NotificationType.overtime_approval_requested:
        raise AppError(status_code=400, code="INVALID_NOTIFICATION_TYPE", message="Not an overtime approval request")
    notification_service.mark_resolved(payload.notification_id)
    return {"ok": True}


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
# 2b. Care metrics — scheduled vs delivered, per service
# ─────────────────────────────────────────
@router.get("/care-metrics", response_model=CareMetricsResponse)
async def get_care_metrics(
    from_date: date = Query(..., description="Start of date range (YYYY-MM-DD)"),
    to_date: date = Query(..., description="End of date range (YYYY-MM-DD)"),
    worker_id: str | None = Query(default=None),
    client_id: str | None = Query(default=None),
    shift_service: ShiftService = Depends(get_shift_service),
):
    return await shift_service.get_care_metrics(from_date, to_date, worker_id, client_id)


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
    payload: ShiftCancelSchema,
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
    payload: ShiftCancelFromSchema,
    shift_service: ShiftService = Depends(get_shift_service),
):
    return await shift_service.cancel_from_date(shift_id, payload)


# ─────────────────────────────────────────
# 10. Edit this occurrence and all following (splits the series)
# ─────────────────────────────────────────
@router.post("/{shift_id}/edit-from")
async def edit_from_date(
    shift_id: str,
    payload: ShiftEditFromSchema,
    shift_service: ShiftService = Depends(get_shift_service),
):
    return await shift_service.edit_from_date(shift_id, payload)
