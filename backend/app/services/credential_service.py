from datetime import date
from pathlib import Path
from sqlalchemy.orm import Session
from fastapi import UploadFile
from supabase_auth.types import User as SupabaseUser
from app.schemas.worker_profile import CredentialCreateSchema, CredentialUpdateSchema, CredentialVerifySchema
from app.repositories.credential_repository import CredentialRepository
from app.repositories.org_member_repository import OrgMemberRepository
from app.repositories.notification_repository import NotificationRepository
from app.core.exceptions import AppError
from app.core.enums import ComplianceDocumentType
from app.db.supabase import get_supabase_client
from uuid import UUID

COMPLIANCE_BUCKET = "compliance-documents"


class CredentialService:

    def __init__(self, db: Session, current_user: SupabaseUser, org_id: UUID):
        self.db = db
        self.current_user = current_user
        self.org_id = org_id
        self.credential_repo = CredentialRepository(db)
        self.org_member_repo = OrgMemberRepository(db)

    def _assert_member_in_org(self, member_id: UUID):
        member = self.org_member_repo.get_active_member(str(member_id), self.org_id)
        if not member:
            raise AppError(status_code=404, code="NOT_FOUND", message="Worker not found")
        return member

    # ── Worker: read own credentials ──────────────────────────────────────────
    def list_own(self):
        return self.credential_repo.list_for_member(self.current_user.id)

    # ── Admin: CRUD for any member's credentials ──────────────────────────────
    def list_for_member(self, member_id: UUID):
        self._assert_member_in_org(member_id)
        return self.credential_repo.list_for_member(member_id)

    def create(self, member_id: UUID, payload: CredentialCreateSchema):
        self._assert_member_in_org(member_id)
        try:
            credential = self.credential_repo.create(
                org_member_id=member_id,
                data=payload.model_dump(exclude_none=True),
            )
            self.db.commit()
            return credential
        except AppError:
            raise
        except Exception as e:
            self.db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    def update(self, member_id: UUID, credential_id: UUID, payload: CredentialUpdateSchema):
        self._assert_member_in_org(member_id)
        credential = self.credential_repo.get_by_id(credential_id, member_id)
        try:
            updated = self.credential_repo.update(
                credential,
                data=payload.model_dump(exclude_none=True),
            )
            self.db.commit()
            return updated
        except AppError:
            raise
        except Exception as e:
            self.db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    def verify(self, member_id: UUID, document_type: ComplianceDocumentType, payload: CredentialVerifySchema):
        member = self._assert_member_in_org(member_id)
        try:
            credential = self.credential_repo.verify_for_member(
                org_member_id=member_id,
                document_type=document_type,
                expiry_date=payload.expiry_date,
                verified_by=self.current_user.id,
            )
            NotificationRepository(self.db).resolve_credential_notification(
                org_id=member.org_id,
                worker_id=member_id,
                document_type=document_type.value,
                resolver_id=self.current_user.id,
            )
            self.db.commit()
            return credential
        except AppError:
            raise
        except Exception as e:
            self.db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    def get_preview_url(self, member_id: UUID, document_type: ComplianceDocumentType) -> str:
        self._assert_member_in_org(member_id)
        credential = self.credential_repo.get_by_document_type(member_id, document_type)
        if not credential or not credential.file_url:
            raise AppError(status_code=404, code="NOT_FOUND", message="No document uploaded for this credential")
        storage = get_supabase_client().storage.from_(COMPLIANCE_BUCKET)
        result = storage.create_signed_url(credential.file_url, 120)
        signed_url = result.get("signedURL") or result.get("signedUrl")
        if not signed_url:
            raise AppError(status_code=500, code="STORAGE_ERROR", message="Could not generate preview URL")
        return signed_url

    async def upload_document(self, member_id: UUID, document_type: ComplianceDocumentType, file: UploadFile):
        self._assert_member_in_org(member_id)
        ext = Path(file.filename).suffix if file.filename else ''
        storage_path = f"{member_id}/{document_type.value}{ext}"
        file_bytes = await file.read()
        storage = get_supabase_client().storage.from_(COMPLIANCE_BUCKET)
        storage.upload(
            path=storage_path,
            file=file_bytes,
            file_options={"content-type": file.content_type or "application/octet-stream", "upsert": "true"},
        )
        try:
            credential = self.credential_repo.upsert_for_member(
                org_member_id=member_id,
                document_type=document_type,
                file_url=storage_path,
            )
            self.db.commit()
            return credential
        except Exception as e:
            self.db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    def get_expiring(self, within_days: int = 30) -> list[dict]:
        today = date.today()
        credentials = self.credential_repo.list_expiring_for_org(self.org_id, within_days)
        return [
            {
                'id': c.id,
                'document_type': c.document_type,
                'expiry_date': c.expiry_date,
                'days_remaining': (c.expiry_date - today).days,
                'worker_id': c.org_member_id,
                'worker_first_name': c.org_member.first_name,
                'worker_last_name': c.org_member.last_name,
            }
            for c in credentials
        ]

    def delete(self, member_id: UUID, credential_id: UUID):
        self._assert_member_in_org(member_id)
        credential = self.credential_repo.get_by_id(credential_id, member_id)
        try:
            self.credential_repo.delete(credential)
            self.db.commit()
        except AppError:
            raise
        except Exception as e:
            self.db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))
