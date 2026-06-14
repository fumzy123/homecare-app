from datetime import date
from uuid import UUID
from sqlalchemy.orm import Session
from supabase_auth.types import User as SupabaseUser
from app.core.enums import AuthorizationStatus
from app.core.exceptions import AppError
from app.models.authorization import Authorization, AuthorizationService as AuthorizationServiceModel
from app.models.client import Client
from app.repositories.authorization_repository import AuthorizationRepository
from app.repositories.organization_repository import OrganizationRepository
from app.schemas.authorization import (
    AuthorizationCreateSchema,
    AuthorizationResponse,
    AuthorizationServiceResponse,
)


class AuthorizationService:
    """Authorization CRUD + lifecycle. Status is derived on read, never stored.
    Amendments create a new authorization that supersedes the old one."""

    def __init__(self, db: Session, current_user: SupabaseUser):
        self.db = db
        self.current_user = current_user
        self.repo = AuthorizationRepository(db)
        employment = OrganizationRepository(db).get_active_employment_for_user(current_user.id)
        if not employment:
            raise AppError(status_code=404, code="NOT_FOUND", message="Member record not found")
        self.org_id = employment.org_id
        self.employment_id = employment.id

    # ── Reads ─────────────────────────────────────────────────────────────────

    def list_for_client(self, client_id: UUID) -> list[AuthorizationResponse]:
        self._assert_client_in_org(client_id)
        auths = self.repo.list_for_client(client_id, self.org_id)
        superseded = {a.supersedes_id for a in auths if a.supersedes_id}
        today = date.today()
        return [self._to_response(a, a.id in superseded, today) for a in auths]

    def get(self, authorization_id: UUID) -> AuthorizationResponse:
        auth = self._get_or_404(authorization_id)
        return self._to_response(auth, self.repo.is_superseded(auth.id), date.today())

    # ── Writes ────────────────────────────────────────────────────────────────

    def create(self, client_id: UUID, payload: AuthorizationCreateSchema) -> AuthorizationResponse:
        self._assert_client_in_org(client_id)
        if payload.supersedes_id:
            # the superseded authorization must belong to the same client/org
            prior = self._get_or_404(payload.supersedes_id)
            if prior.client_id != client_id:
                raise AppError(status_code=400, code="BAD_REQUEST",
                               message="Cannot supersede an authorization from another client")
        try:
            auth = Authorization(
                org_id=self.org_id,
                client_id=client_id,
                created_by=self.employment_id,
                funder=payload.funder,
                funder_file_number=payload.funder_file_number,
                authorization_number=payload.authorization_number,
                covering_start=payload.covering_start,
                covering_end=payload.covering_end,
                date_issued=payload.date_issued,
                authorized_by=payload.authorized_by,
                hours_period=payload.hours_period,
                client_monthly_contribution_amount=payload.client_monthly_contribution_amount,
                invoice_to=payload.invoice_to,
                notes=payload.notes,
                supersedes_id=payload.supersedes_id,
            )
            auth.services = [
                AuthorizationServiceModel(
                    service_type=s.service_type,
                    authorized_hours=s.authorized_hours,
                )
                for s in payload.services
            ]
            self.repo.add(auth)
            self.db.commit()
            self.db.refresh(auth)
        except AppError:
            self.db.rollback()
            raise
        except Exception as e:
            self.db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

        return self._to_response(auth, False, date.today())

    def cancel(self, authorization_id: UUID) -> AuthorizationResponse:
        auth = self._get_or_404(authorization_id)
        if auth.cancelled_at is not None:
            raise AppError(status_code=400, code="ALREADY_CANCELLED",
                           message="Authorization is already cancelled")
        try:
            self.repo.cancel(auth)
            self.db.commit()
            self.db.refresh(auth)
        except Exception:
            self.db.rollback()
            raise
        return self._to_response(auth, self.repo.is_superseded(auth.id), date.today())

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _get_or_404(self, authorization_id: UUID) -> Authorization:
        auth = self.repo.get_by_id(authorization_id)
        if not auth or auth.org_id != self.org_id:
            raise AppError(status_code=404, code="NOT_FOUND", message="Authorization not found")
        return auth

    def _assert_client_in_org(self, client_id: UUID) -> None:
        exists = (
            self.db.query(Client.id)
            .filter(Client.id == client_id, Client.org_id == self.org_id)
            .first()
        )
        if not exists:
            raise AppError(status_code=404, code="NOT_FOUND", message="Client not found")

    @staticmethod
    def _compute_status(auth: Authorization, is_superseded: bool, today: date) -> AuthorizationStatus:
        if auth.cancelled_at is not None:
            return AuthorizationStatus.cancelled
        if is_superseded:
            return AuthorizationStatus.superseded
        if today < auth.covering_start:
            return AuthorizationStatus.pending
        if auth.covering_end is not None and today > auth.covering_end:
            return AuthorizationStatus.expired
        return AuthorizationStatus.active

    def _to_response(self, auth: Authorization, is_superseded: bool, today: date) -> AuthorizationResponse:
        return AuthorizationResponse(
            id=auth.id,
            client_id=auth.client_id,
            funder=auth.funder,
            funder_file_number=auth.funder_file_number,
            authorization_number=auth.authorization_number,
            covering_start=auth.covering_start,
            covering_end=auth.covering_end,
            date_issued=auth.date_issued,
            authorized_by=auth.authorized_by,
            hours_period=auth.hours_period,
            client_monthly_contribution_amount=(
                float(auth.client_monthly_contribution_amount)
                if auth.client_monthly_contribution_amount is not None else None
            ),
            invoice_to=auth.invoice_to,
            cancelled_at=auth.cancelled_at,
            supersedes_id=auth.supersedes_id,
            notes=auth.notes,
            created_at=auth.created_at,
            status=self._compute_status(auth, is_superseded, today),
            services=[AuthorizationServiceResponse.model_validate(s) for s in auth.services],
        )
