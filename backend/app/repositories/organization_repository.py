from sqlalchemy.orm import Session
from app.models.organization import Organization
from app.models.person import Person
from app.models.employment import Employment


class OrganizationRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_active_employment_for_user(self, supabase_user_id) -> Employment | None:
        """Resolve the active employment for a Supabase user. Used by get_user_org_id."""
        person = self.db.query(Person).filter(
            Person.supabase_user_id == supabase_user_id
        ).first()
        if not person:
            return None
        return self.db.query(Employment).filter(
            Employment.person_id == person.id,
            Employment.deleted_at.is_(None),
        ).first()

    def get_by_id(self, org_id) -> Organization | None:
        return self.db.query(Organization).filter(Organization.id == org_id).first()

    def get_by_stripe_customer_id(self, stripe_customer_id: str) -> Organization | None:
        return self.db.query(Organization).filter(
            Organization.stripe_customer_id == stripe_customer_id
        ).first()

    def add(self, org: Organization) -> None:
        self.db.add(org)

    def flush(self) -> None:
        self.db.flush()
