from sqlalchemy.orm import Session
from app.models.invitation import Invitation
from app.models.org_member import OrgMember
from app.models.organization import Organization
from app.core.exceptions import AppError


class InvitationRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_org_by_id(self, org_id) -> Organization | None:
        """Fetch an organisation by primary key.

        Returns None if no record exists — does not raise.

        Args:
            org_id: Primary key of the organisation to fetch.

        Returns:
            The matching Organization ORM instance, or None if not found.
        """
        return self.db.query(Organization).filter(Organization.id == org_id).first()

    def get_member_by_email_and_org(self, email: str, org_id) -> OrgMember | None:
        """Fetch an org member matching an email address within an organisation.

        Used to check whether the invitee is already a member of this org.
        Returns None if no match exists.

        Args:
            email: Email address to look up.
            org_id: Organisation scope (tenant isolation).

        Returns:
            The matching OrgMember ORM instance, or None if not found.
        """
        return self.db.query(OrgMember).filter(
            OrgMember.email == email,
            OrgMember.org_id == org_id,
        ).first()

    def get_member_by_email_other_org(self, email: str, org_id) -> OrgMember | None:
        """Fetch an org member matching an email address in any organisation except the given one.

        Used to detect cross-org conflicts before sending an invite.
        Returns None if the email is not registered with any other org.

        Args:
            email: Email address to look up.
            org_id: Organisation to exclude from the search.

        Returns:
            The matching OrgMember ORM instance from a different org,
            or None if not found.
        """
        return self.db.query(OrgMember).filter(
            OrgMember.email == email,
            OrgMember.org_id != org_id,
        ).first()

    def get_pending_by_email_and_org(self, email: str, org_id) -> Invitation | None:
        """Fetch an unaccepted invitation for an email within an organisation.

        Returns None if no pending invitation exists. Does not raise.

        Args:
            email: Email address the invitation was sent to.
            org_id: Organisation scope (tenant isolation).

        Returns:
            The matching Invitation ORM instance, or None if not found.
        """
        return self.db.query(Invitation).filter(
            Invitation.org_id == org_id,
            Invitation.email == email,
            Invitation.accepted_at == None,  # noqa: E711
        ).first()

    def get_by_id_and_org(self, invitation_id, org_id) -> Invitation:
        """Fetch an invitation by primary key scoped to an organisation.

        Raises AppError with 404 if no matching record exists — never
        returns None.

        Args:
            invitation_id: Primary key of the invitation to fetch.
            org_id: Organisation the invitation must belong to (tenant isolation).

        Returns:
            The matching Invitation ORM instance.

        Raises:
            AppError: If no invitation matches invitation_id and org_id.
        """
        invitation = self.db.query(Invitation).filter(
            Invitation.id == invitation_id,
            Invitation.org_id == org_id,
        ).first()
        if not invitation:
            raise AppError(status_code=404, code="NOT_FOUND", message="Invitation not found")
        return invitation

    def list_by_org(self, org_id) -> list[Invitation]:
        """Fetch all invitations for an organisation regardless of status.

        Results are unordered and include accepted, pending, and expired records.

        Args:
            org_id: Organisation scope (tenant isolation).

        Returns:
            List of Invitation instances. Returns an empty list if none exist.
        """
        return self.db.query(Invitation).filter(Invitation.org_id == org_id).all()

    def add(self, invitation: Invitation) -> None:
        """Stage a new Invitation for insertion.

        Does not commit — the caller is responsible for calling db.commit()
        or db.flush() as needed.

        Args:
            invitation: The Invitation ORM instance to stage.
        """
        self.db.add(invitation)

    def flush(self) -> None:
        """Flush pending inserts to the database without committing.

        Sends the staged Invitation to the DB so its primary key is available
        before the Supabase invite API call that follows in the same
        transaction. Does not commit — the transaction remains open.
        """
        self.db.flush()

    def delete(self, invitation: Invitation) -> None:
        """Stage an Invitation for hard deletion.

        Does not commit — the caller is responsible for calling db.commit().
        This is a hard delete; Invitation has no soft-delete column.

        Args:
            invitation: The Invitation ORM instance to delete.
        """
        self.db.delete(invitation)
