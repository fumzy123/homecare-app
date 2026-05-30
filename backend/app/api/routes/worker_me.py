from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import get_current_user
from app.core.exceptions import AppError
from app.models.org_member import OrgMember
from app.schemas.shift import ShiftOccurrenceResponse
from app.core.enums import ComplianceDocumentType
from app.schemas.worker_profile import WorkerProfileResponse, WorkerProfileUpdateSchema, WorkerStatsResponse, CredentialResponse, CredentialUpsertSchema
from app.services.shift_service import ShiftService
from app.repositories.credential_repository import CredentialRepository

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
# 2. Update own profile (worker-editable fields only)
# ─────────────────────────────────────────
@router.patch("/profile", response_model=WorkerProfileResponse)
async def update_my_profile(
    payload: WorkerProfileUpdateSchema,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    member = db.query(OrgMember).filter(OrgMember.id == current_user.id).first()
    if not member:
        raise AppError(status_code=404, code="NOT_FOUND", message="Profile not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(member, field, value)
    db.commit()
    db.refresh(member)
    return member


# ─────────────────────────────────────────
# 3. Get own stats (hours this week, streaks)
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


# ─────────────────────────────────────────
# 4. Get own credentials
# ─────────────────────────────────────────
@router.get("/credentials", response_model=list[CredentialResponse])
async def get_my_credentials(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo = CredentialRepository(db)
    return repo.list_for_member(current_user.id)


# ─────────────────────────────────────────
# 5. Upload / replace a compliance document
# ─────────────────────────────────────────
@router.put("/credentials/{document_type}", response_model=CredentialResponse)
async def upsert_my_credential(
    document_type: ComplianceDocumentType,
    payload: CredentialUpsertSchema,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo = CredentialRepository(db)
    credential = repo.upsert_for_member(current_user.id, document_type, payload.file_url)
    db.commit()
    db.refresh(credential)
    return credential
