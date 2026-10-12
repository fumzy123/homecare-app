from app.models.billing_period import BillingPeriod


class BillingPeriodRepository:
    def __init__(self, db):
        self.db = db

    def get(self, org_id, subscription_id, starts_at):
        return self.db.query(BillingPeriod).filter(
            BillingPeriod.org_id == org_id, BillingPeriod.subscription_id == subscription_id,
            BillingPeriod.starts_at == starts_at,
        ).first()

    def for_subscription(self, org_id, subscription_id):
        return self.db.query(BillingPeriod).filter(
            BillingPeriod.org_id == org_id, BillingPeriod.subscription_id == subscription_id,
        ).all()

    def add(self, period):
        self.db.add(period)
