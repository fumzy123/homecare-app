from sqlalchemy.orm import Session
from app.models.org_member import OrgMember
from app.models.invitation import Invitation
from app.core.enums import OrgMemberRole
from app.core.exceptions import AppError


class OrgMemberRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_active_member(self, member_id, org_id) -> OrgMember:
        """Fetch a non-deleted org member by primary key scoped to an organisation.

        Raises AppError with 404 if no matching active record exists —
        never returns None.

        Args:
            member_id: Primary key of the org member to fetch.
            org_id: Organisation the member must belong to (tenant isolation).

        Returns:
            The matching OrgMember ORM instance.

        Raises:
            AppError: If no active member matches member_id and org_id.
        """
        member = self.db.query(OrgMember).filter(
            OrgMember.id == member_id,
            OrgMember.org_id == org_id,
            OrgMember.deleted_at == None,  # noqa: E711
        ).first()
        if not member:
            raise AppError(status_code=404, code="NOT_FOUND", message="Member not found")
        return member

    def get_by_id(self, member_id) -> OrgMember | None:
        """Fetch an org member by primary key with no org or deletion filter.

        Used for existence checks (e.g. has this invite already been accepted).
        Returns None if no record exists.

        Args:
            member_id: Primary key of the org member to fetch.

        Returns:
            The matching OrgMember ORM instance, or None if not found.
        """
        return self.db.query(OrgMember).filter(OrgMember.id == member_id).first()

    def get_by_id_no_org_filter(self, member_id) -> OrgMember | None:
        """Fetch an active org member by primary key without an org scope.

        Filters out soft-deleted members. Used when the org_id is not yet
        known (e.g. self-update where the caller is the member).

        Args:
            member_id: Primary key of the org member to fetch.

        Returns:
            The matching non-deleted OrgMember ORM instance, or None if
            not found or soft-deleted.
        """
        return self.db.query(OrgMember).filter(
            OrgMember.id == member_id,
            OrgMember.deleted_at == None,  # noqa: E711
        ).first()

    def get_all_by_org(self, org_id, role: OrgMemberRole | None = None) -> list[OrgMember]:
        """Fetch all non-deleted org members for an organisation.

        Optionally filters by role. Results are unordered.

        Args:
            org_id: Organisation scope (tenant isolation).
            role: If provided, only members with this role are returned.

        Returns:
            List of OrgMember instances. Returns an empty list if none exist.
        """
        query = self.db.query(OrgMember).filter(
            OrgMember.org_id == org_id,
            OrgMember.deleted_at == None,  # noqa: E711
        )
        if role is not None:
            query = query.filter(OrgMember.role == role)
        return query.all()

    def get_pending_invitation(self, email: str, org_id) -> Invitation | None:
        """Fetch an unaccepted invitation matching an email and organisation.

        Returns None if no pending invitation exists. Does not raise.

        Args:
            email: Email address the invitation was sent to.
            org_id: Organisation scope (tenant isolation).

        Returns:
            The matching Invitation ORM instance, or None if not found.
        """
        return self.db.query(Invitation).filter(
            Invitation.email == email,
            Invitation.org_id == org_id,
            Invitation.accepted_at == None,  # noqa: E711
        ).first()

    def add(self, member: OrgMember) -> None:
        """Stage a new OrgMember for insertion.

        Does not commit — the caller is responsible for calling db.commit().

        Args:
            member: The OrgMember ORM instance to stage.
        """
        self.db.add(member)
