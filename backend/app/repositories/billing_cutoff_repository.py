from app.models.organization import Organization
from app.models.billing_usage_cutoff import BillingUsageCutoff


class BillingCutoffRepository:
    def __init__(self, db):
        self.db = db

    def lock_organization(self, org_id):
        # Historical billing remains available for cancelled/archived agencies.
        return self.db.query(Organization).filter(Organization.id == org_id).populate_existing().with_for_update().first()

    def organizations(self):
        return [row[0] for row in self.db.query(Organization.id).filter(
            Organization.onboarding_deadline_at.is_not(None), Organization.subscription_id.is_not(None),
            Organization.trial_ends_at.is_not(None),
        ).order_by(Organization.id).all()]

    def for_subscription(self, org_id, subscription_id):
        return self.db.query(BillingUsageCutoff).filter(
            BillingUsageCutoff.org_id == org_id, BillingUsageCutoff.subscription_id == subscription_id,
        ).all()

    def get(self, org_id, subscription_id, starts_at):
        return self.db.query(BillingUsageCutoff).filter(
            BillingUsageCutoff.org_id == org_id, BillingUsageCutoff.subscription_id == subscription_id,
            BillingUsageCutoff.starts_at == starts_at,
        ).first()

    def add(self, cutoff):
        self.db.add(cutoff)
