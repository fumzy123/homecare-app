from sqlalchemy.orm import Session
from app.models.organization import Organization
from app.models.org_member import OrgMember
from app.core.exceptions import AppError


class OrganizationRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_member_by_id(self, member_id) -> OrgMember | None:
        """Fetch an org member by primary key with no additional filters.

        Used to resolve the org_id for the currently authenticated user.
        Returns None if no record exists.

        Args:
            member_id: Primary key of the org member to fetch.

        Returns:
            The matching OrgMember ORM instance, or None if not found.
        """
        return self.db.query(OrgMember).filter(OrgMember.id == member_id).first()

    def get_by_id(self, org_id) -> Organization | None:
        """Fetch an organisation by primary key.

        Returns None if no record exists — does not raise.

        Args:
            org_id: Primary key of the organisation to fetch.

        Returns:
            The matching Organization ORM instance, or None if not found.
        """
        return self.db.query(Organization).filter(Organization.id == org_id).first()

    def get_by_stripe_customer_id(self, stripe_customer_id: str) -> Organization | None:
        """Fetch an organisation by its Stripe customer ID.

        Used by Stripe webhook handlers to look up the org from event metadata.
        Returns None if no record exists — does not raise.

        Args:
            stripe_customer_id: The Stripe customer ID to look up.

        Returns:
            The matching Organization ORM instance, or None if not found.
        """
        return self.db.query(Organization).filter(
            Organization.stripe_customer_id == stripe_customer_id
        ).first()

    def add(self, org: Organization) -> None:
        """Stage a new Organization for insertion.

        Does not commit — the caller is responsible for calling db.commit().

        Args:
            org: The Organization ORM instance to stage.
        """
        self.db.add(org)

    def add_member(self, member: OrgMember) -> None:
        """Stage a new OrgMember for insertion.

        Does not commit — the caller is responsible for calling db.commit().
        Used during org registration where both the org and its first owner
        member are staged in the same transaction.

        Args:
            member: The OrgMember ORM instance to stage.
        """
        self.db.add(member)

    def flush(self) -> None:
        """Flush pending inserts to the database without committing.

        Sends staged records to the DB so their primary keys are available
        for use in subsequent inserts within the same transaction. Does not
        commit — the transaction remains open.
        """
        self.db.flush()
