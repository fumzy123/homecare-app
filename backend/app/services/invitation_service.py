from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from supabase_auth.types import User as SupabaseUser
from app.db.supabase import get_supabase_client
from app.models.invitation import Invitation
from app.core.exceptions import AppError
from app.schemas.invitation import CreateInvitationSchema
from app.services.org_service import OrgService
from app.models.organization import Organization
from app.core.config import settings
import uuid


class InvitationService:

    # ─────────────────────────────────────────
    # 1. Create an invitation
    # Inserts a row into invitations table,
    # then sends the Supabase invite email.
    # Only admins/owners can call this.
    # ─────────────────────────────────────────
    @staticmethod
    async def create_invitation(payload: CreateInvitationSchema, current_user: SupabaseUser, db: Session):
        supabase = get_supabase_client()
        try:
            org_id = OrgService.get_admin_org_id(current_user, db)

            org = db.query(Organization).filter(Organization.id == org_id).first()
            org_name = org.name if org else ""

            # Guard against duplicate pending invite for the same email + org
            existing = db.query(Invitation).filter(
                Invitation.org_id == org_id,
                Invitation.email == payload.email,
                Invitation.accepted_at == None,  # noqa: E711
            ).first()
            if existing:
                raise AppError(
                    status_code=409,
                    code="INVITE_ALREADY_SENT",
                    message=f"A pending invite already exists for {payload.email}",
                )

            expires_at = datetime.now(timezone.utc) + timedelta(days=7)

            invitation = Invitation(
                id=uuid.uuid4(),
                email=payload.email,
                role=payload.role,
                org_id=org_id,
                invited_by=current_user.id,
                expires_at=expires_at,
            )
            db.add(invitation)
            db.flush()

            # Send the invite email with role + org_id baked into JWT metadata
            invite_response = supabase.auth.admin.invite_user_by_email(
                payload.email,
                options={
                    "redirect_to": f"{settings.frontend_url}/accept-invite",
                    "data": {
                        "role": payload.role,
                        "org_id": str(org_id),
                        "org_name": org_name,
                    },
                }
            )

            # Store the Supabase user ID so we can clean up auth.users on revoke
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

    # ─────────────────────────────────────────
    # 2. List all invitations for the org
    # Returns both pending and accepted
    # ─────────────────────────────────────────
    @staticmethod
    async def list_invitations(current_user: SupabaseUser, db: Session):
        try:
            org_id = OrgService.get_admin_org_id(current_user, db)
            return db.query(Invitation).filter(Invitation.org_id == org_id).all()
        except AppError:
            raise
        except Exception as e:
            raise AppError(status_code=400, code="BAD_REQUEST", message=str(e))

    # ─────────────────────────────────────────
    # 3. Revoke an invitation
    # Deletes the row — invited user can no longer accept
    # ─────────────────────────────────────────
    @staticmethod
    async def revoke_invitation(invitation_id: str, current_user: SupabaseUser, db: Session):
        supabase = get_supabase_client()
        try:
            org_id = OrgService.get_admin_org_id(current_user, db)

            invitation = db.query(Invitation).filter(
                Invitation.id == invitation_id,
                Invitation.org_id == org_id,
            ).first()

            if not invitation:
                raise AppError(status_code=404, code="NOT_FOUND", message="Invitation not found")

            supabase_user_id = invitation.supabase_user_id

            db.delete(invitation)
            db.commit()

            # Remove the pending user from Supabase auth so the same email
            # can be re-invited cleanly without hitting a 400 "user exists" error.
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
