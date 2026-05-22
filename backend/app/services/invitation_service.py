from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from supabase_auth.types import User as SupabaseUser
from app.db.supabase import get_supabase_client
from app.models.invitation import Invitation
from app.core.exceptions import AppError
from app.schemas.invitation import CreateInvitationSchema, InvitationResponse, INVITE_EXPIRY_SECONDS
from app.services.org_service import OrgService
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
        accepted_at=inv.accepted_at,
    )


def _is_expired(inv: Invitation) -> bool:
    expiry = inv.invited_at + timedelta(seconds=INVITE_EXPIRY_SECONDS)
    return expiry < datetime.now(timezone.utc)


class InvitationService:

    @staticmethod
    async def create_invitation(payload: CreateInvitationSchema, current_user: SupabaseUser, db: Session):
        supabase = get_supabase_client()
        try:
            repo = InvitationRepository(db)
            org_id = OrgService.get_admin_org_id(current_user, db)

            if payload.email.lower() == current_user.email.lower():
                raise AppError(
                    status_code=400,
                    code="CANNOT_INVITE_SELF",
                    message="You cannot invite yourself",
                )

            org = repo.get_org_by_id(org_id)
            org_name = org.name if org else ""

            if repo.get_member_by_email_and_org(payload.email, org_id):
                raise AppError(
                    status_code=409,
                    code="ALREADY_A_MEMBER",
                    message="This person is already a member of your organization",
                )

            if repo.get_member_by_email_other_org(payload.email, org_id):
                raise AppError(
                    status_code=409,
                    code="REGISTERED_WITH_OTHER_ORG",
                    message="This person is already registered with another organization",
                )

            existing = repo.get_pending_by_email_and_org(payload.email, org_id)
            if existing:
                if not _is_expired(existing):
                    raise AppError(
                        status_code=409,
                        code="INVITE_ALREADY_SENT",
                        message=f"A pending invite already exists for {payload.email}",
                    )
                return await InvitationService._send_and_refresh(
                    existing, org_name, current_user, supabase, db
                )

            invitation = Invitation(
                id=uuid.uuid4(),
                email=payload.email,
                role=payload.role,
                org_id=org_id,
                invited_by=current_user.id,
            )
            repo.add(invitation)
            repo.flush()  # get the invitation id before the Supabase API call

            invite_response = supabase.auth.admin.invite_user_by_email(
                payload.email,
                options={
                    "redirect_to": f"{settings.frontend_url}/accept-invite",
                    "data": {
                        "role": payload.role,
                        "org_id": str(org_id),
                        "org_name": org_name,
                        "invited_by": f"{current_user.user_metadata.get('first_name', '')} {current_user.user_metadata.get('last_name', '')}".strip(),
                    },
                }
            )

            if invite_response and invite_response.user:
                invitation.supabase_user_id = invite_response.user.id

            db.commit()
            return {"message": f"Invite sent to {payload.email}"}

        except AppError:
            db.rollback()
            raise
        except Exception as e:
            db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    @staticmethod
    async def list_invitations(current_user: SupabaseUser, db: Session):
        try:
            repo = InvitationRepository(db)
            org_id = OrgService.get_admin_org_id(current_user, db)
            return [_to_response(inv) for inv in repo.list_by_org(org_id)]
        except AppError:
            raise
        except Exception as e:
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    @staticmethod
    async def resend_invitation(invitation_id: str, current_user: SupabaseUser, db: Session):
        supabase = get_supabase_client()
        try:
            repo = InvitationRepository(db)
            org_id = OrgService.get_admin_org_id(current_user, db)
            invitation = repo.get_by_id_and_org(invitation_id, org_id)

            if invitation.accepted_at:
                raise AppError(
                    status_code=409,
                    code="ALREADY_ACCEPTED",
                    message="This invitation has already been accepted",
                )

            org = repo.get_org_by_id(org_id)
            org_name = org.name if org else ""
            return await InvitationService._send_and_refresh(
                invitation, org_name, current_user, supabase, db
            )

        except AppError:
            db.rollback()
            raise
        except Exception as e:
            db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    @staticmethod
    async def revoke_invitation(invitation_id: str, current_user: SupabaseUser, db: Session):
        supabase = get_supabase_client()
        try:
            repo = InvitationRepository(db)
            org_id = OrgService.get_admin_org_id(current_user, db)
            invitation = repo.get_by_id_and_org(invitation_id, org_id)
            supabase_user_id = invitation.supabase_user_id

            repo.delete(invitation)
            db.commit()

            if supabase_user_id:
                try:
                    supabase.auth.admin.delete_user(str(supabase_user_id))
                except Exception:
                    pass

            return {"message": "Invitation revoked"}

        except AppError:
            db.rollback()
            raise
        except Exception as e:
            db.rollback()
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ── internal helper ───────────────────────────────────────────────────────

    @staticmethod
    async def _send_and_refresh(invitation: Invitation, org_name: str, current_user: SupabaseUser, supabase, db: Session):
        if invitation.supabase_user_id:
            try:
                supabase.auth.admin.delete_user(str(invitation.supabase_user_id))
            except Exception:
                pass

        invite_response = supabase.auth.admin.invite_user_by_email(
            invitation.email,
            options={
                "redirect_to": f"{settings.frontend_url}/accept-invite",
                "data": {
                    "role": invitation.role,
                    "org_id": str(invitation.org_id),
                    "org_name": org_name,
                    "invited_by": f"{current_user.user_metadata.get('first_name', '')} {current_user.user_metadata.get('last_name', '')}".strip(),
                },
            }
        )

        invitation.invited_at = datetime.now(timezone.utc)
        invitation.invited_by = current_user.id
        invitation.supabase_user_id = invite_response.user.id if invite_response and invite_response.user else None

        db.commit()
        return {"message": f"Invite resent to {invitation.email}"}
