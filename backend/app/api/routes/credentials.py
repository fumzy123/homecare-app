from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from uuid import UUID
from app.db.session import get_db
from app.core.security import require_admin
from app.services.credential_service import CredentialService
from app.services.org_service import OrgService
from app.schemas.worker_profile import CredentialResponse, CredentialCreateSchema, CredentialUpdateSchema, CredentialVerifySchema, CredentialPreviewUrlResponse
from app.core.enums import ComplianceDocumentType

router = APIRouter(prefix="/org-members/{member_id}/credentials", tags=["Credentials"])


def get_credential_service(
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
) -> CredentialService:
    return CredentialService(db, current_user, org_id=OrgService.get_user_org_id(current_user, db))


@router.get("", response_model=list[CredentialResponse])
async def list_credentials(
    member_id: UUID,
    credential_service: CredentialService = Depends(get_credential_service),
):
    return credential_service.list_for_member(member_id)


@router.post("", response_model=CredentialResponse, status_code=201)
async def create_credential(
    member_id: UUID,
    payload: CredentialCreateSchema,
    credential_service: CredentialService = Depends(get_credential_service),
):
    return credential_service.create(member_id, payload)


@router.patch("/{credential_id}", response_model=CredentialResponse)
async def update_credential(
    member_id: UUID,
    credential_id: UUID,
    payload: CredentialUpdateSchema,
    credential_service: CredentialService = Depends(get_credential_service),
):
    return credential_service.update(member_id, credential_id, payload)


@router.get("/{document_type}/preview-url", response_model=CredentialPreviewUrlResponse)
async def get_credential_preview_url(
    member_id: UUID,
    document_type: ComplianceDocumentType,
    credential_service: CredentialService = Depends(get_credential_service),
):
    url = credential_service.get_preview_url(member_id, document_type)
    return CredentialPreviewUrlResponse(url=url)


@router.patch("/{document_type}/verify", response_model=CredentialResponse)
async def verify_credential(
    member_id: UUID,
    document_type: ComplianceDocumentType,
    payload: CredentialVerifySchema,
    credential_service: CredentialService = Depends(get_credential_service),
):
    return credential_service.verify(member_id, document_type, payload)


@router.delete("/{credential_id}", status_code=204)
async def delete_credential(
    member_id: UUID,
    credential_id: UUID,
    credential_service: CredentialService = Depends(get_credential_service),
):
    credential_service.delete(member_id, credential_id)
