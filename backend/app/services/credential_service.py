from sqlalchemy.orm import Session
from supabase_auth.types import User as SupabaseUser
from app.schemas.worker_profile import CredentialCreateSchema, CredentialUpdateSchema
from app.repositories.credential_repository import CredentialRepository
from app.repositories.org_member_repository import OrgMemberRepository
from app.core.exceptions import AppError
from uuid import UUID


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
