from app.models.billing_notice import BillingNotice
from app.models.organization import Organization
from app.models.billing_agreement import BillingAgreement


class BillingNoticeRepository:
    def __init__(self, db):
        self.db = db

    def get(self, key):
        return self.db.get(BillingNotice, key)

    def add(self, notice):
        self.db.add(notice)

    def trial_org_ids(self, now, until):
        return [row[0] for row in self.db.query(Organization.id).filter(
            Organization.deleted_at.is_(None), Organization.is_active.is_(True),
            Organization.onboarding_deadline_at.is_not(None), Organization.subscription_status == "trialing",
            Organization.trial_ends_at > now, Organization.trial_ends_at <= until,
        ).all()]

    def annual_org_ids(self, now, until):
        return [row[0] for row in self.db.query(Organization.id).join(
            BillingAgreement, BillingAgreement.org_id == Organization.id,
        ).filter(Organization.deleted_at.is_(None), Organization.is_active.is_(True),
            Organization.subscription_status == "active", BillingAgreement.base_interval == "year",
            BillingAgreement.plan_version >= 2, Organization.subscription_current_period_end > now,
            Organization.subscription_current_period_end <= until).all()]
