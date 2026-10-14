from app.models.billing_review_request import BillingReviewRequest
from app.models.billing_period import BillingPeriod
from app.models.organization import Organization


class BillingReviewRepository:
    def __init__(self, db):
        self.db = db

    def period(self, org_id, period_id):
        return self.db.query(BillingPeriod).filter_by(org_id=org_id, id=period_id).first()

    def by_request(self, org_id, request_id):
        return self.db.query(BillingReviewRequest).filter_by(org_id=org_id, request_id=request_id).first()

    def for_period(self, org_id, period_id):
        return self.db.query(BillingReviewRequest).filter_by(org_id=org_id, period_id=period_id).order_by(
            BillingReviewRequest.submitted_at.desc(), BillingReviewRequest.id.desc()).limit(100).all()

    def queue(self):
        return self.db.query(BillingReviewRequest, Organization.name.label("agency_name")).join(
            Organization, Organization.id == BillingReviewRequest.org_id).filter(
            BillingReviewRequest.status == "open").order_by(
            BillingReviewRequest.submitted_at, BillingReviewRequest.id).limit(101).all()

    def lock(self, request_id):
        return self.db.query(BillingReviewRequest).filter_by(id=request_id).with_for_update().first()

    def add(self, row):
        self.db.add(row)
