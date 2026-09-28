from app.models.billing_adjustment import BillingAdjustment, BillingAdjustmentEvent


class BillingAdjustmentRepository:
    def __init__(self, db):
        self.db = db

    def by_request(self, org_id, period_id, request_id):
        return self.db.query(BillingAdjustment).filter(
            BillingAdjustment.org_id == org_id, BillingAdjustment.period_id == period_id,
            BillingAdjustment.request_id == request_id,
        ).first()

    def get(self, org_id, period_id, adjustment_id):
        return self.db.query(BillingAdjustment).filter(
            BillingAdjustment.org_id == org_id, BillingAdjustment.period_id == period_id,
            BillingAdjustment.id == adjustment_id,
        ).first()

    def latest_approved(self, org_id, period_id):
        return self.db.query(BillingAdjustment).filter(
            BillingAdjustment.org_id == org_id, BillingAdjustment.period_id == period_id,
            BillingAdjustment.status == "approved",
        ).order_by(BillingAdjustment.approval_sequence.desc()).first()

    def list(self, org_id, period_id):
        return self.db.query(BillingAdjustment).filter(
            BillingAdjustment.org_id == org_id, BillingAdjustment.period_id == period_id,
        ).order_by(BillingAdjustment.proposed_at, BillingAdjustment.id).all()

    def events(self, org_id, period_id):
        return self.db.query(BillingAdjustmentEvent).join(
            BillingAdjustment, BillingAdjustment.id == BillingAdjustmentEvent.adjustment_id,
        ).filter(BillingAdjustment.org_id == org_id, BillingAdjustment.period_id == period_id).order_by(
            BillingAdjustmentEvent.occurred_at, BillingAdjustmentEvent.id,
        ).all()

    def add(self, row):
        self.db.add(row)

    def add_event(self, event):
        self.db.add(event)
