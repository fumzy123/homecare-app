from datetime import datetime, timedelta, timezone
from app.core.enums import EmploymentStatus
from app.repositories.invitation_repository import InvitationRepository
from app.repositories.organization_repository import OrganizationRepository
from app.schemas.invitation import INVITE_EXPIRY_SECONDS


class WorkerAccountService:
    """Resolve account setup and agency membership from trusted database records."""

    def __init__(self, db, current_user):
        self.current_user = current_user
        self.org_repo = OrganizationRepository(db)
        self.invitation_repo = InvitationRepository(db)

    def get_account(self):
        user = self.current_user
        result = {"status": "no_access", "email": user.email}
        employment = self.org_repo.get_active_employment_for_user(user.id)
        if employment:
            if employment.employment_status != EmploymentStatus.active:
                return result
            org = self.org_repo.get_by_id(employment.org_id)
            if not org:
                return result
            return dict(result, status="active", first_name=employment.person.first_name,
                        org_name=org.name, org_id=org.id, employment_id=employment.id,
                        role=employment.role)
        invitation = self.invitation_repo.get_pending_for_identity(user.id, user.email)
        if not invitation:
            return result
        if datetime.now(timezone.utc) > invitation.invited_at + timedelta(seconds=INVITE_EXPIRY_SECONDS):
            return dict(result, status="expired")
        org = self.org_repo.get_by_id(invitation.org_id)
        if not org:
            return result
        return dict(result, status="pending", org_name=org.name, org_id=org.id,
                    role=invitation.role)
