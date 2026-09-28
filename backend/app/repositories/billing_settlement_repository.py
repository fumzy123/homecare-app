from sqlalchemy import exists, or_, and_
from app.models.billing_period import BillingPeriod
from app.models.billing_settlement import BillingSettlement, BillingInvoiceHold
from app.models.billing_usage_snapshot import BillingUsageSnapshot
from app.models.billing_adjustment import BillingAdjustment


class BillingSettlementRepository:
    def __init__(self, db):
        self.db = db

    def lock(self, settlement_id):
        return self.db.query(BillingSettlement).filter(BillingSettlement.id == settlement_id).populate_existing().with_for_update().first()

    def by_source(self, source_key):
        return self.db.query(BillingSettlement).filter(BillingSettlement.source_key == source_key).first()

    def period_rows(self, org_id, period_id):
        return self.db.query(BillingSettlement).filter(BillingSettlement.org_id == org_id,
            BillingSettlement.period_id == period_id).order_by(BillingSettlement.created_at, BillingSettlement.id).all()

    def approved_adjustments(self, org_id, period_id):
        return self.db.query(BillingAdjustment).filter(BillingAdjustment.org_id == org_id,
            BillingAdjustment.period_id == period_id, BillingAdjustment.status == "approved"
        ).order_by(BillingAdjustment.approval_sequence).all()

    def unprepared_periods(self):
        return self.db.query(BillingUsageSnapshot.org_id, BillingUsageSnapshot.period_id).filter(
            ~exists().where((BillingSettlement.period_id == BillingUsageSnapshot.period_id)
                            & BillingSettlement.adjustment_id.is_(None))).all()

    def adjustment_periods(self):
        return self.db.query(BillingAdjustment.org_id, BillingAdjustment.period_id).filter(
            BillingAdjustment.status == "approved", BillingAdjustment.settlement_status == "pending",
        ).distinct().all()

    def work_ids(self):
        return [r[0] for r in self.db.query(BillingSettlement.id).filter(or_(
            BillingSettlement.state.in_(("ready", "processing")),
            and_(BillingSettlement.state == "invoiced", BillingSettlement.payment_status != "paid"),
            and_(BillingSettlement.state == "credited", BillingSettlement.payment_status == "refund_pending"),
        )).order_by(BillingSettlement.created_at, BillingSettlement.id).all()]

    def completed_usage(self, org_id, subscription_id, starts_at):
        return self.db.query(BillingSettlement).join(BillingPeriod, BillingPeriod.id == BillingSettlement.period_id).filter(
            BillingSettlement.org_id == org_id, BillingSettlement.adjustment_id.is_(None),
            BillingPeriod.subscription_id == subscription_id, BillingPeriod.starts_at == starts_at,
            BillingSettlement.state.in_(("invoiced", "zero")),
        ).first()

    def credit_ids(self, org_id):
        rows = self.db.query(BillingSettlement.steps).filter(
            BillingSettlement.org_id == org_id, BillingSettlement.amount_cents < 0,
        ).all()
        return {value["result_id"] for (steps,) in rows for name, value in steps.items()
                if name.startswith("credit-") and value.get("result_id")}

    def hold(self, org_id, subscription_id, starts_at):
        return self.db.query(BillingInvoiceHold).filter(BillingInvoiceHold.org_id == org_id,
            BillingInvoiceHold.subscription_id == subscription_id, BillingInvoiceHold.usage_starts_at == starts_at).first()

    def hold_by_invoice(self, invoice_id):
        return self.db.query(BillingInvoiceHold).filter(BillingInvoiceHold.invoice_id == invoice_id).first()

    def add(self, row):
        self.db.add(row)
