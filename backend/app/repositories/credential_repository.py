from datetime import datetime, date, timedelta, timezone
from sqlalchemy.orm import Session, joinedload
from app.models.credential import Credential
from app.models.person import Person
from app.models.employment import Employment
from app.core.enums import ComplianceDocumentType
from app.core.exceptions import AppError
from uuid import UUID


class CredentialRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_for_member(self, person_id: UUID) -> list[Credential]:
        return (
            self.db.query(Credential)
            .filter(Credential.person_id == person_id)
            .order_by(Credential.uploaded_at.desc())
            .all()
        )

    def get_by_id(self, credential_id: UUID, person_id: UUID) -> Credential:
        credential = (
            self.db.query(Credential)
            .filter(
                Credential.id == credential_id,
                Credential.person_id == person_id,
            )
            .first()
        )
        if not credential:
            raise AppError(status_code=404, code="NOT_FOUND", message="Credential not found")
        return credential

    def get_by_document_type(self, person_id: UUID, document_type: ComplianceDocumentType) -> Credential | None:
        return (
            self.db.query(Credential)
            .filter(
                Credential.person_id == person_id,
                Credential.document_type == document_type,
            )
            .first()
        )

    def create(self, person_id: UUID, data: dict) -> Credential:
        credential = Credential(person_id=person_id, **data)
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
        person_id: UUID,
        document_type: ComplianceDocumentType,
        file_url: str,
    ) -> Credential:
        credential = (
            self.db.query(Credential)
            .filter(
                Credential.person_id == person_id,
                Credential.document_type == document_type,
            )
            .first()
        )
        if credential:
            credential.file_url = file_url
            credential.uploaded_at = datetime.now(timezone.utc)
            # New file invalidates previous verification — admin must re-verify
            credential.verified_at = None
            credential.verified_by = None
            credential.expiry_date = None
        else:
            credential = Credential(
                person_id=person_id,
                document_type=document_type,
                file_url=file_url,
            )
            self.db.add(credential)
        self.db.flush()
        return credential

    def verify_for_member(
        self,
        person_id: UUID,
        document_type: ComplianceDocumentType,
        expiry_date,
        verified_by: UUID,
    ) -> Credential:
        credential = (
            self.db.query(Credential)
            .filter(
                Credential.person_id == person_id,
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

    def list_expiring_for_org(self, org_id: UUID, within_days: int) -> list[Credential]:
        today = date.today()
        cutoff = today + timedelta(days=within_days)
        return (
            self.db.query(Credential)
            .options(joinedload(Credential.person))
            .join(Person, Credential.person_id == Person.id)
            .join(Employment, Employment.person_id == Person.id)
            .filter(
                Employment.org_id == org_id,
                Employment.deleted_at.is_(None),
                Credential.expiry_date.isnot(None),
                Credential.expiry_date >= today,
                Credential.expiry_date <= cutoff,
            )
            .order_by(Credential.expiry_date.asc())
            .all()
        )

    def delete(self, credential: Credential) -> None:
        self.db.delete(credential)
        self.db.flush()
