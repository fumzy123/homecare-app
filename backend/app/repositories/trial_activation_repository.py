from sqlalchemy import exists
from sqlalchemy.orm import Session

from app.models.organization import Organization
from app.models.trial_activation import TrialActivation


class TrialActivationRepository:
    def __init__(self, db: Session):
        self.db = db

    def lock_organization(self, org_id):
        return self.db.query(Organization).filter(
            Organization.id == org_id,
            Organization.deleted_at.is_(None),
            Organization.is_active.is_(True),
        ).with_for_update().first()

    def get_for_org(self, org_id):
        return self.db.query(TrialActivation).filter(TrialActivation.org_id == org_id).first()

    def due_org_ids(self, now, limit=100):
        return [row[0] for row in self.db.query(Organization.id).filter(
            Organization.deleted_at.is_(None),
            Organization.is_active.is_(True),
            Organization.onboarding_deadline_at <= now,
            Organization.trial_starts_at.is_(None),
            Organization.subscription_id.is_(None),
            ~exists().where(TrialActivation.org_id == Organization.id),
        ).order_by(Organization.onboarding_deadline_at, Organization.id).limit(limit).all()]

    def add(self, request):
        self.db.add(request)
