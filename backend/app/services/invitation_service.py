from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from supabase_auth.types import User as SupabaseUser
from app.db.supabase import get_supabase_client
from app.models.invitation import Invitation
from app.core.exceptions import AppError
from app.schemas.invitation import CreateInvitationSchema, InvitationResponse, INVITE_EXPIRY_SECONDS
from app.core.config import settings
from app.repositories.invitation_repository import InvitationRepository
import uuid


def _to_response(inv: Invitation) -> InvitationResponse:
    return InvitationResponse(
        id=inv.id,
        email=inv.email,
        role=inv.role,
        org_id=inv.org_id,
        invited_by=inv.invited_by,
        invited_at=inv.invited_at,
        expires_at=inv.invited_at + timedelta(seconds=INVITE_EXPIRY_SECONDS),
    )


def _is_expired(inv: Invitation) -> bool:
    expiry = inv.invited_at + timedelta(seconds=INVITE_EXPIRY_SECONDS)
    return expiry < datetime.now(timezone.utc)


class InvitationService:

    def __init__(self, db: Session, current_user: SupabaseUser):
        self.db = db
        self.current_user = current_user
        self.invitation_repo = InvitationRepository(db)
        from app.repositories.organization_repository import OrganizationRepository
        org_repo = OrganizationRepository(db)
        current_employment = org_repo.get_active_employment_for_user(current_user.id)
        if not current_employment:
            raise AppError(status_code=404, code="NOT_FOUND", message="Member record not found")
        self.org_id = current_employment.org_id
        self.current_employment_id = current_employment.id
        self.supabase = get_supabase_client()

    async def create_invitation(self, payload: CreateInvitationSchema):
        try:
            if payload.email.lower() == self.current_user.email.lower():
                raise AppError(
                    status_code=400,
                    code="CANNOT_INVITE_SELF",
                    message="You cannot invite yourself",
                )

            org = self.invitation_repo.get_org_by_id(self.org_id)
            org_name = org.name if org else ""

            if self.invitation_repo.get_member_by_email_and_org(payload.email, self.org_id):
                raise AppError(
                    status_code=409,
                    code="ALREADY_A_MEMBER",
                    message="This person is already a member of your organization",
                )

            if self.invitation_repo.get_member_by_email_other_org(payload.email, self.org_id):
                raise AppError(
                    status_code=409,
                    code="REGISTERED_WITH_OTHER_ORG",
                    message="This person is already registered with another organization",
                )

            existing = self.invitation_repo.get_pending_by_email_and_org(payload.email, self.org_id)
            if existing:
                if not _is_expired(existing):
                    raise AppError(
                        status_code=409,
                        code="INVITE_ALREADY_SENT",
                        message=f"A pending invite already exists for {payload.email}",
                    )
                return await self._send_and_refresh(existing, org_name)

            invitation = Invitation(
                id=uuid.uuid4(),
                email=payload.email,
                role=payload.role,
                employment_type=payload.employment_type,
                org_id=self.org_id,
                invited_by=self.current_employment_id,
            )
            self.invitation_repo.add(invitation)
            self.invitation_repo.flush()

            invite_response = self.supabase.auth.admin.invite_user_by_email(
                payload.email,
                options={
                    "redirect_to": f"{settings.frontend_url}/accept-invite",
                    "data": {
                        "role": payload.role,
                        "org_id": str(self.org_id),
                        "org_name": org_name,
                        "invited_by": f"{self.current_user.user_metadata.get('first_name', '')} {self.current_user.user_metadata.get('last_name', '')}".strip(),
                        "employment_type": payload.employment_type,
                    },
                }
            )

            if invite_response and invite_response.user:
                invitation.supabase_user_id = invite_response.user.id

            self.db.commit()
            return {"message": f"Invite sent to {payload.email}"}

        except AppError:
            self.db.rollback()
            raise
        except Exception as e:
            self.db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    async def list_invitations(self):
        try:
            return [_to_response(inv) for inv in self.invitation_repo.list_by_org(self.org_id)]
        except AppError:
            raise
        except Exception as e:
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    async def resend_invitation(self, invitation_id: str):
        try:
            # Only pending invites exist in the table (accepted ones are deleted),
            # so any row found here is resendable.
            invitation = self.invitation_repo.get_by_id_and_org(invitation_id, self.org_id)

            org = self.invitation_repo.get_org_by_id(self.org_id)
            org_name = org.name if org else ""
            return await self._send_and_refresh(invitation, org_name)

        except AppError:
            self.db.rollback()
            raise
        except Exception as e:
            self.db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    async def revoke_invitation(self, invitation_id: str):
        try:
            invitation = self.invitation_repo.get_by_id_and_org(invitation_id, self.org_id)
            supabase_user_id = invitation.supabase_user_id

            self.invitation_repo.delete(invitation)
            self.db.commit()

            if supabase_user_id:
                try:
                    self.supabase.auth.admin.delete_user(str(supabase_user_id))
                except Exception:
                    pass

            return {"message": "Invitation revoked"}

        except AppError:
            self.db.rollback()
            raise
        except Exception as e:
            self.db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ── internal helper ───────────────────────────────────────────────────────

    async def _send_and_refresh(self, invitation: Invitation, org_name: str):
        if invitation.supabase_user_id:
            try:
                self.supabase.auth.admin.delete_user(str(invitation.supabase_user_id))
            except Exception:
                pass

        invite_response = self.supabase.auth.admin.invite_user_by_email(
            invitation.email,
            options={
                "redirect_to": f"{settings.frontend_url}/accept-invite",
                "data": {
                    "role": invitation.role,
                    "org_id": str(invitation.org_id),
                    "org_name": org_name,
                    "invited_by": f"{self.current_user.user_metadata.get('first_name', '')} {self.current_user.user_metadata.get('last_name', '')}".strip(),
                    "employment_type": invitation.employment_type,
                },
            }
        )

        invitation.invited_at = datetime.now(timezone.utc)
        invitation.invited_by = self.current_employment_id
        invitation.supabase_user_id = invite_response.user.id if invite_response and invite_response.user else None

        self.db.commit()
        return {"message": f"Invite resent to {invitation.email}"}
