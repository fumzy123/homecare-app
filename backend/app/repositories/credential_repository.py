from sqlalchemy.orm import Session
from app.models.credential import Credential
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

    def delete(self, credential: Credential) -> None:
        self.db.delete(credential)
        self.db.flush()
