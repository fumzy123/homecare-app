from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import require_admin
from app.services.credential_service import CredentialService
from app.services.org_service import OrgService
from app.schemas.worker_profile import ExpiringCredentialResponse

router = APIRouter(prefix="/credentials", tags=["Compliance"])


def get_credential_service(
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
) -> CredentialService:
    return CredentialService(db, current_user, org_id=OrgService.get_user_org_id(current_user, db))


@router.get("/expiring", response_model=list[ExpiringCredentialResponse])
async def get_expiring_credentials(
    within_days: int = Query(default=30, ge=1, le=365),
    credential_service: CredentialService = Depends(get_credential_service),
):
    return credential_service.get_expiring(within_days)
