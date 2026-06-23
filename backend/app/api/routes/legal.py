from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.db.session import get_db
from app.core.security import get_current_user
from app.core.exceptions import AppError
from app.models.person import Person
from app.models.employment import Employment
from app.models.organization import Organization

router = APIRouter(prefix="/legal", tags=["Legal"])

CURRENT_TERMS_VERSION = "0.0"


class TermsStatusResponse(BaseModel):
    accepted: bool
    accepted_version: str | None
    current_version: str


class AcceptTermsPayload(BaseModel):
    version: str


def _resolve_org(current_user, db: Session) -> Organization:
    person = db.query(Person).filter(Person.supabase_user_id == current_user.id).first()
    if not person:
        raise AppError(status_code=404, code="NOT_FOUND", message="Member not found")
    employment = db.query(Employment).filter(
        Employment.person_id == person.id,
        Employment.deleted_at.is_(None),
    ).first()
    if not employment:
        raise AppError(status_code=404, code="NOT_FOUND", message="Member not found")
    org = db.query(Organization).filter(Organization.id == employment.org_id).first()
    if not org:
        raise AppError(status_code=404, code="NOT_FOUND", message="Organization not found")
    return org


@router.get("/status", response_model=TermsStatusResponse)
async def get_terms_status(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    org = _resolve_org(current_user, db)
    accepted = org.terms_accepted_version == CURRENT_TERMS_VERSION
    return TermsStatusResponse(
        accepted=accepted,
        accepted_version=org.terms_accepted_version,
        current_version=CURRENT_TERMS_VERSION,
    )


@router.post("/accept", response_model=TermsStatusResponse)
async def accept_terms(
    payload: AcceptTermsPayload,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.version != CURRENT_TERMS_VERSION:
        raise AppError(status_code=400, code="INVALID_VERSION", message="Terms version mismatch")

    org = _resolve_org(current_user, db)
    org.terms_accepted_at = datetime.now(timezone.utc)
    org.terms_accepted_version = CURRENT_TERMS_VERSION
    db.commit()

    return TermsStatusResponse(
        accepted=True,
        accepted_version=CURRENT_TERMS_VERSION,
        current_version=CURRENT_TERMS_VERSION,
    )
