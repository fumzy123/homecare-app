from uuid import UUID
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import require_admin
from app.services.authorization_service import AuthorizationService
from app.services.authorization_compliance_service import AuthorizationComplianceService
from app.services.org_service import OrgService
from app.schemas.authorization import (
    AuthorizationCreateSchema,
    AuthorizationResponse,
    AuthorizationComplianceResponse,
)

router = APIRouter(tags=["Authorizations"])


def get_authorization_service(
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
) -> AuthorizationService:
    return AuthorizationService(db, current_user)


# ── Authorizations (nested under a client) ────────────────────────────────────

@router.get("/clients/{client_id}/authorizations", response_model=list[AuthorizationResponse])
async def list_client_authorizations(
    client_id: UUID,
    service: AuthorizationService = Depends(get_authorization_service),
):
    return service.list_for_client(client_id)


@router.post("/clients/{client_id}/authorizations", response_model=AuthorizationResponse)
async def create_client_authorization(
    client_id: UUID,
    payload: AuthorizationCreateSchema,
    service: AuthorizationService = Depends(get_authorization_service),
):
    return service.create(client_id, payload)


@router.get("/authorizations/{authorization_id}", response_model=AuthorizationResponse)
async def get_authorization(
    authorization_id: UUID,
    service: AuthorizationService = Depends(get_authorization_service),
):
    return service.get(authorization_id)


@router.post("/authorizations/{authorization_id}/cancel", response_model=AuthorizationResponse)
async def cancel_authorization(
    authorization_id: UUID,
    service: AuthorizationService = Depends(get_authorization_service),
):
    return service.cancel(authorization_id)


# ── Compliance (planned weekly care plan vs authorized) ───────────────────────

@router.get("/clients/{client_id}/authorization-compliance", response_model=AuthorizationComplianceResponse)
async def get_authorization_compliance(
    client_id: UUID,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    org_id = OrgService.get_user_org_id(current_user, db)
    return AuthorizationComplianceService(db).check(client_id, org_id)
