from datetime import date
from uuid import UUID
from fastapi import APIRouter, Depends, Query, BackgroundTasks
from sqlalchemy.orm import Session
from app.db.session import get_db, SessionLocal
from app.core.security import get_current_user
from app.core.exceptions import AppError
from app.models.person import Person
from app.models.employment import Employment
from app.schemas.shift import ShiftOccurrenceResponse
from app.core.enums import ComplianceDocumentType
from app.schemas.worker_profile import WorkerProfileResponse, WorkerProfileUpdateSchema, WorkerStatsResponse, CredentialResponse, CredentialUpsertSchema
from app.schemas.notification import NotificationListResponse
from app.schemas.placement import WorkerPlacementResponse
from app.services.shift_service import ShiftService
from app.services.notification_service import NotificationService
from app.services.placement_service import PlacementService
from app.repositories.credential_repository import CredentialRepository
from app.repositories.organization_repository import OrganizationRepository

router = APIRouter(prefix="/me", tags=["Worker — Me"])

# Fields that trigger a profile_updated notification when changed
TRACKED_PROFILE_FIELDS = {
    "phone_number", "email", "street", "city", "province", "postal_code",
    "emergency_contact_name", "emergency_contact_phone", "emergency_contact_relationship",
}


def _resolve_person_and_employment(current_user, db: Session) -> tuple[Person, Employment]:
    person = db.query(Person).filter(Person.supabase_user_id == current_user.id).first()
    if not person:
        raise AppError(status_code=404, code="NOT_FOUND", message="Profile not found")
    employment = db.query(Employment).filter(
        Employment.person_id == person.id,
        Employment.deleted_at.is_(None),
    ).first()
    if not employment:
        raise AppError(status_code=404, code="NOT_FOUND", message="Profile not found")
    return person, employment


def _profile_response(person: Person, employment: Employment) -> dict:
    return {
        "id":            employment.id,
        "first_name":    person.first_name,
        "last_name":     person.last_name,
        "email":         person.email,
        "phone_number":  person.phone_number,
        "gender":        person.gender,
        "date_of_birth": person.date_of_birth,
        "languages":     person.languages,
        "role":                   employment.role,
        "employment_status":      employment.employment_status,
        "employment_type":        employment.employment_type,
        "hire_date":              employment.hire_date,
        "has_vehicle":            employment.has_vehicle,
        "street":        person.street,
        "city":          person.city,
        "province":      person.province,
        "postal_code":   person.postal_code,
        "availability":           [
            {"id": b.id, "day_of_week": b.day_of_week, "start_time": b.start_time, "end_time": b.end_time}
            for b in sorted(person.availability_blocks, key=lambda x: (x.day_of_week.value, x.start_time))
        ],
        "max_hours_per_week":     employment.max_hours_per_week,
        "pet_tolerance":          person.pet_tolerance,
        "preferred_client_types": person.preferred_client_types,
        "pay_rate":               employment.pay_rate,
        "emergency_contact_name":         person.emergency_contact_name,
        "emergency_contact_phone":        person.emergency_contact_phone,
        "emergency_contact_relationship": person.emergency_contact_relationship,
    }


def get_worker_shift_service(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ShiftService:
    return ShiftService(db, current_user)


# ── Background notification helpers ───────────────────────────────────────────

def _bg_notify_credential(org_id, worker_id, document_type: str):
    db = SessionLocal()
    try:
        NotificationService(db).notify_credential_uploaded(org_id, worker_id, document_type)
    finally:
        db.close()


def _bg_notify_profile(org_id, worker_id, changed_fields: list[str]):
    db = SessionLocal()
    try:
        NotificationService(db).notify_profile_updated(org_id, worker_id, changed_fields)
    finally:
        db.close()


# ─────────────────────────────────────────
# 1. Get own profile
# ─────────────────────────────────────────
@router.get("/profile", response_model=WorkerProfileResponse)
async def get_my_profile(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    person, employment = _resolve_person_and_employment(current_user, db)
    return _profile_response(person, employment)


# ─────────────────────────────────────────
# 2. Update own profile (worker-editable fields only)
# ─────────────────────────────────────────
@router.patch("/profile", response_model=WorkerProfileResponse)
async def update_my_profile(
    payload: WorkerProfileUpdateSchema,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    person, employment = _resolve_person_and_employment(current_user, db)
    update_data = payload.model_dump(exclude_unset=True)

    changed_fields = [
        field for field, new_value in update_data.items()
        if field in TRACKED_PROFILE_FIELDS and getattr(person, field, None) != new_value
    ]

    for field, value in update_data.items():
        setattr(person, field, value)
    db.commit()
    db.refresh(person)

    if changed_fields:
        background_tasks.add_task(
            _bg_notify_profile, employment.org_id, employment.id, changed_fields
        )

    return _profile_response(person, employment)


# ─────────────────────────────────────────
# 3. Get own stats (hours this week, streaks)
# ─────────────────────────────────────────
@router.get("/stats", response_model=WorkerStatsResponse)
async def get_my_stats(
    shift_service: ShiftService = Depends(get_worker_shift_service),
):
    return await shift_service.get_worker_stats(str(shift_service.current_employment_id))


# ─────────────────────────────────────────
# 4. Get own shifts for a date range
# ─────────────────────────────────────────
@router.get("/shifts", response_model=list[ShiftOccurrenceResponse])
async def get_my_shifts(
    from_date: date = Query(..., description="Start of date range (YYYY-MM-DD)"),
    to_date: date = Query(..., description="End of date range (YYYY-MM-DD)"),
    shift_service: ShiftService = Depends(get_worker_shift_service),
):
    return await shift_service.get_shifts(from_date, to_date, worker_id=str(shift_service.current_employment_id))


# ─────────────────────────────────────────
# 5. Get own credentials
# ─────────────────────────────────────────
@router.get("/credentials", response_model=list[CredentialResponse])
async def get_my_credentials(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    person, _ = _resolve_person_and_employment(current_user, db)
    repo = CredentialRepository(db)
    return repo.list_for_member(person.id)


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
async def upsert_my_credential(
    document_type: ComplianceDocumentType,
    payload: CredentialUpsertSchema,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    person, employment = _resolve_person_and_employment(current_user, db)

    repo = CredentialRepository(db)
    credential = repo.upsert_for_member(person.id, document_type, payload.file_url)
    db.commit()
    db.refresh(credential)

    background_tasks.add_task(
        _bg_notify_credential, employment.org_id, employment.id, document_type.value
    )

    return credential
