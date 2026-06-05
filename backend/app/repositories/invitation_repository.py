from sqlalchemy.orm import Session
from app.models.invitation import Invitation
from app.models.person import Person
from app.models.employment import Employment
from app.models.organization import Organization
from app.core.exceptions import AppError


class InvitationRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_org_by_id(self, org_id) -> Organization | None:
        return self.db.query(Organization).filter(Organization.id == org_id).first()

    def get_member_by_email_and_org(self, email: str, org_id) -> Employment | None:
        """Return the active employment in this org for the given email, or None."""
        person = self.db.query(Person).filter(Person.email == email).first()
        if not person:
            return None
        return self.db.query(Employment).filter(
            Employment.person_id == person.id,
            Employment.org_id == org_id,
            Employment.deleted_at.is_(None),
        ).first()

    def get_member_by_email_other_org(self, email: str, org_id) -> Employment | None:
        """Return an active employment in any OTHER org for the given email, or None."""
        person = self.db.query(Person).filter(Person.email == email).first()
        if not person:
            return None
        return self.db.query(Employment).filter(
            Employment.person_id == person.id,
            Employment.org_id != org_id,
            Employment.deleted_at.is_(None),
        ).first()

    def get_pending_by_email_and_org(self, email: str, org_id) -> Invitation | None:
        return self.db.query(Invitation).filter(
            Invitation.org_id == org_id,
            Invitation.email == email,
            Invitation.accepted_at == None,  # noqa: E711
        ).first()

    def get_by_id_and_org(self, invitation_id, org_id) -> Invitation:
        invitation = self.db.query(Invitation).filter(
            Invitation.id == invitation_id,
            Invitation.org_id == org_id,
        ).first()
        if not invitation:
            raise AppError(status_code=404, code="NOT_FOUND", message="Invitation not found")
        return invitation

    def list_by_org(self, org_id) -> list[Invitation]:
        return self.db.query(Invitation).filter(Invitation.org_id == org_id).all()

    def add(self, invitation: Invitation) -> None:
        self.db.add(invitation)

    def flush(self) -> None:
        self.db.flush()

    def delete(self, invitation: Invitation) -> None:
        self.db.delete(invitation)
