from app.models.billing_agreement import BillingAgreement
from app.models.trial_activation import TrialActivation


class BillingAgreementRepository:
    def __init__(self, db):
        self.db = db

    def get_for_org(self, org_id):
        return self.db.query(BillingAgreement).filter(BillingAgreement.org_id == org_id).first()

    def add(self, agreement):
        self.db.add(agreement)

    def pending_org_ids(self, limit=100):
        return [row[0] for row in self.db.query(TrialActivation.org_id).filter(
            TrialActivation.status.in_(["pending", "awaiting_card"]),
        ).order_by(TrialActivation.requested_at, TrialActivation.id).limit(limit).all()]
