from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.credential import Credential
from app.core.enums import ComplianceDocumentType
from app.core.exceptions import AppError
from uuid import UUID


class CredentialRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_for_member(self, org_member_id: UUID) -> list[Credential]:
        return (
            self.db.query(Credential)
            .filter(Credential.org_member_id == org_member_id)
            .order_by(Credential.uploaded_at.desc())
            .all()
        )

    def get_by_id(self, credential_id: UUID, org_member_id: UUID) -> Credential:
        credential = (
            self.db.query(Credential)
            .filter(
                Credential.id == credential_id,
                Credential.org_member_id == org_member_id,
            )
            .first()
        )
        if not credential:
            raise AppError(status_code=404, code="NOT_FOUND", message="Credential not found")
        return credential

    def get_by_document_type(self, org_member_id: UUID, document_type: ComplianceDocumentType) -> Credential | None:
        return (
            self.db.query(Credential)
            .filter(
                Credential.org_member_id == org_member_id,
                Credential.document_type == document_type,
            )
            .first()
        )

    def create(self, org_member_id: UUID, data: dict) -> Credential:
        credential = Credential(org_member_id=org_member_id, **data)
        self.db.add(credential)
        self.db.flush()
        return credential

    def update(self, credential: Credential, data: dict) -> Credential:
        for key, value in data.items():
            if value is not None:
                setattr(credential, key, value)
        self.db.flush()
        return credential

    def upsert_for_member(
        self,
        org_member_id: UUID,
        document_type: ComplianceDocumentType,
        file_url: str,
    ) -> Credential:
        credential = (
            self.db.query(Credential)
            .filter(
                Credential.org_member_id == org_member_id,
                Credential.document_type == document_type,
            )
            .first()
        )
        if credential:
            credential.file_url = file_url
            credential.uploaded_at = datetime.now(timezone.utc)
        else:
            credential = Credential(
                org_member_id=org_member_id,
                document_type=document_type,
                file_url=file_url,
            )
            self.db.add(credential)
        self.db.flush()
        return credential

    def verify_for_member(
        self,
        org_member_id: UUID,
        document_type: ComplianceDocumentType,
        expiry_date,
        verified_by: UUID,
    ) -> Credential:
        credential = (
            self.db.query(Credential)
            .filter(
                Credential.org_member_id == org_member_id,
                Credential.document_type == document_type,
            )
            .first()
        )
        if not credential:
            raise AppError(status_code=404, code="NOT_FOUND", message="Credential not found")
        credential.expiry_date = expiry_date
        credential.verified_at = datetime.now(timezone.utc)
        credential.verified_by = verified_by
        self.db.flush()
        return credential

    def delete(self, credential: Credential) -> None:
        self.db.delete(credential)
        self.db.flush()
