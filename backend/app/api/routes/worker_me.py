from uuid import UUID
from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import get_current_user
from app.core.exceptions import AppError
from app.core.enums import ComplianceDocumentType
from app.schemas.worker_profile import WorkerProfileResponse, WorkerProfileUpdateSchema, WorkerStatsResponse, CredentialResponse, CredentialUpsertSchema
from app.schemas.notification import NotificationListResponse
from app.schemas.placement import WorkerPlacementResponse
from app.services.shift_service import ShiftService
from app.services.notification_service import NotificationService
from app.services.placement_service import PlacementService
from app.services.worker_profile_service import WorkerProfileService
from app.schemas.worker_profile import WorkerAvailabilityUpdateSchema
from app.repositories.organization_repository import OrganizationRepository
from app.services.worker_account_service import WorkerAccountService
from app.schemas.worker_account import WorkerAccountResponse

router = APIRouter(prefix="/me", tags=["Worker — Me"])


def get_worker_account_service(
    current_user=Depends(get_current_user), db: Session = Depends(get_db),
) -> WorkerAccountService:
    return WorkerAccountService(db, current_user)


@router.get("/account", response_model=WorkerAccountResponse)
def get_my_account(worker_account_service: WorkerAccountService = Depends(get_worker_account_service)):
    return worker_account_service.get_account()

def get_worker_profile_service(
    current_user=Depends(get_current_user), db: Session = Depends(get_db),
) -> WorkerProfileService:
    return WorkerProfileService(db, current_user)


def get_worker_shift_service(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ShiftService:
    return ShiftService(db, current_user)


@router.get("/profile", response_model=WorkerProfileResponse)
def get_my_profile(worker_profile_service: WorkerProfileService = Depends(get_worker_profile_service)):
    return worker_profile_service.get_profile()


@router.patch("/profile", response_model=WorkerProfileResponse)
def update_my_profile(
    payload: WorkerProfileUpdateSchema,
    background_tasks: BackgroundTasks,
    worker_profile_service: WorkerProfileService = Depends(get_worker_profile_service),
):
    return worker_profile_service.update_profile(payload, background_tasks)


@router.patch("/availability", response_model=WorkerProfileResponse)
def update_my_availability(
    payload: WorkerAvailabilityUpdateSchema,
    background_tasks: BackgroundTasks,
    worker_profile_service: WorkerProfileService = Depends(get_worker_profile_service),
):
    return worker_profile_service.update_availability(payload, background_tasks)


# ─────────────────────────────────────────
# 3. Get own stats (hours this week, streaks)
# ─────────────────────────────────────────
@router.get("/stats", response_model=WorkerStatsResponse)
async def get_my_stats(
    shift_service: ShiftService = Depends(get_worker_shift_service),
):
    return await shift_service.get_worker_stats(str(shift_service.current_employment_id))


# ─────────────────────────────────────────
# 5. Get own credentials
# ─────────────────────────────────────────
@router.get("/credentials", response_model=list[CredentialResponse])
def get_my_credentials(worker_profile_service: WorkerProfileService = Depends(get_worker_profile_service)):
    return worker_profile_service.list_credentials()


# ─────────────────────────────────────────
# 6. Get own notifications
# ─────────────────────────────────────────
@router.get("/notifications", response_model=NotificationListResponse)
async def get_my_notifications(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    employment = OrganizationRepository(db).get_active_employment_for_user(current_user.id)
    if not employment:
        raise AppError(status_code=404, code="NOT_FOUND", message="Member record not found")
    return NotificationService(db, current_user_id=employment.id).list_for_current_worker()


# ─────────────────────────────────────────
# 7. Mark own notification as read
# ─────────────────────────────────────────
@router.patch("/notifications/{notification_id}/read")
async def mark_my_notification_read(
    notification_id: UUID,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    employment = OrganizationRepository(db).get_active_employment_for_user(current_user.id)
    if not employment:
        raise AppError(status_code=404, code="NOT_FOUND", message="Member record not found")
    NotificationService(db, current_user_id=employment.id).mark_read(notification_id)
    return {"ok": True}


# ─────────────────────────────────────────
# 8. Get a single placement (worker view — includes has_interest)
# ─────────────────────────────────────────
@router.get("/placements/{placement_id}", response_model=WorkerPlacementResponse)
async def get_my_placement(
    placement_id: UUID,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    employment = OrganizationRepository(db).get_active_employment_for_user(current_user.id)
    if not employment:
        raise AppError(status_code=404, code="NOT_FOUND", message="Member record not found")
    return PlacementService(db, current_user, org_id=employment.org_id).get_for_worker(placement_id)


# ─────────────────────────────────────────
# 9. Upload / replace a compliance document
# ─────────────────────────────────────────
@router.put("/credentials/{document_type}", response_model=CredentialResponse)
def upsert_my_credential(
    document_type: ComplianceDocumentType,
    payload: CredentialUpsertSchema,
    background_tasks: BackgroundTasks,
    worker_profile_service: WorkerProfileService = Depends(get_worker_profile_service),
):
    return worker_profile_service.upsert_credential(document_type, payload, background_tasks)
