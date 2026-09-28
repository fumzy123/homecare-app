from sqlalchemy import exists
from app.models.billing_period import BillingPeriod
from app.models.billing_usage_snapshot import BillingUsageSnapshot


class BillingFinalizationRepository:
    def __init__(self, db):
        self.db = db

    def due_periods(self, now):
        return self.db.query(BillingPeriod.org_id, BillingPeriod.id).filter(
            BillingPeriod.finalization_eligible_at <= now,
            ~exists().where(BillingUsageSnapshot.period_id == BillingPeriod.id),
        ).order_by(BillingPeriod.finalization_eligible_at, BillingPeriod.id).all()

    def lock_period(self, org_id, period_id):
        return self.db.query(BillingPeriod).filter(
            BillingPeriod.org_id == org_id, BillingPeriod.id == period_id,
        ).with_for_update().first()

    def snapshot(self, org_id, period_id):
        return self.db.query(BillingUsageSnapshot).filter(
            BillingUsageSnapshot.org_id == org_id, BillingUsageSnapshot.period_id == period_id,
        ).first()

    def add(self, snapshot):
        self.db.add(snapshot)

    def history(self, org_id, before=None, limit=21):
        query = self.db.query(BillingUsageSnapshot.period_id, BillingUsageSnapshot.finalized_at,
            BillingUsageSnapshot.active_client_count, BillingUsageSnapshot.additional_clients,
            BillingUsageSnapshot.usage_amount_cents, BillingPeriod.starts_at, BillingPeriod.ends_at,
            BillingPeriod.agency_timezone, BillingPeriod.currency).join(
                BillingPeriod, BillingPeriod.id == BillingUsageSnapshot.period_id
            ).filter(BillingUsageSnapshot.org_id == org_id, BillingPeriod.org_id == org_id)
        if before:
            from sqlalchemy import or_, and_
            query = query.filter(or_(BillingUsageSnapshot.finalized_at < before.finalized_at,
                and_(BillingUsageSnapshot.finalized_at == before.finalized_at,
                     BillingUsageSnapshot.period_id < before.period_id)))
        return query.order_by(BillingUsageSnapshot.finalized_at.desc(), BillingUsageSnapshot.period_id.desc()).limit(limit).all()
