from sqlalchemy import and_, or_
from app.models.billing_period import BillingPeriod
from app.models.billing_usage_snapshot import BillingUsageSnapshot
from app.models.billing_settlement import BillingSettlement
from app.models.billing_adjustment import BillingAdjustment
from app.models.billing_usage_cutoff import BillingUsageCutoff


class BillingUpcomingRepository:
    def __init__(self, db):
        self.db = db

    def pending_periods(self, org_id, now):
        return self.db.query(BillingPeriod.id, BillingPeriod.starts_at, BillingPeriod.ends_at,
            BillingPeriod.agency_timezone, BillingPeriod.finalization_eligible_at, BillingPeriod.currency,
            BillingUsageSnapshot.usage_amount_cents, BillingSettlement.state,
            BillingUsageCutoff.state.label('cutoff_state')).outerjoin(
                BillingUsageSnapshot, and_(BillingUsageSnapshot.period_id == BillingPeriod.id,
                                          BillingUsageSnapshot.org_id == org_id)
            ).outerjoin(BillingSettlement, and_(BillingSettlement.period_id == BillingPeriod.id,
                BillingSettlement.org_id == org_id, BillingSettlement.adjustment_id.is_(None))
            ).outerjoin(BillingUsageCutoff, and_(BillingUsageCutoff.org_id == org_id,
                BillingUsageCutoff.subscription_id == BillingPeriod.subscription_id,
                BillingUsageCutoff.starts_at == BillingPeriod.starts_at)
            ).filter(BillingPeriod.org_id == org_id, BillingPeriod.ends_at <= now,
                or_(BillingSettlement.id.is_(None), BillingSettlement.state.notin_(['invoiced', 'zero']))
            ).order_by(BillingPeriod.ends_at, BillingPeriod.id).all()

    def pending_corrections(self, org_id):
        return self.db.query(BillingAdjustment.id, BillingAdjustment.period_id, BillingAdjustment.amount_cents,
            BillingAdjustment.currency, BillingAdjustment.settlement_status, BillingSettlement.state,
            BillingSettlement.payment_status).outerjoin(BillingSettlement,
                and_(BillingSettlement.adjustment_id == BillingAdjustment.id, BillingSettlement.org_id == org_id)
            ).filter(BillingAdjustment.org_id == org_id, BillingAdjustment.status == 'approved',
                BillingAdjustment.amount_cents != 0, BillingAdjustment.settlement_status != 'settled'
            ).order_by(BillingAdjustment.approval_sequence, BillingAdjustment.id).all()
