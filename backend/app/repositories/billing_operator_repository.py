from sqlalchemy import func, or_, and_
from app.models.organization import Organization
from app.models.billing_settlement import BillingSettlement, BillingInvoiceHold
from app.models.billing_usage_cutoff import BillingUsageCutoff


class BillingOperatorRepository:
    def __init__(self, db):
        self.db = db

    def agencies(self, search='', before=None):
        query = self.db.query(Organization.id, Organization.name, Organization.subscription_status,
            Organization.onboarding_deadline_at, Organization.deleted_at).filter(
                func.lower(Organization.name).contains(search.lower(), autoescape=True))
        if before:
            query = query.filter(Organization.id > before)
        return query.order_by(Organization.id).limit(21).all()

    def issues(self, org_id):
        settlements = self.db.query(BillingSettlement.id, BillingSettlement.period_id, BillingSettlement.state,
            BillingSettlement.payment_status, BillingSettlement.error_code, BillingSettlement.invoice_id,
            BillingSettlement.updated_at).filter(BillingSettlement.org_id == org_id, or_(
                BillingSettlement.state.in_(['ready', 'processing', 'needs_review']),
                and_(BillingSettlement.state == 'invoiced', BillingSettlement.payment_status != 'paid'),
                BillingSettlement.payment_status == 'refund_pending',
            )).order_by(BillingSettlement.updated_at.desc(), BillingSettlement.id).limit(101).all()
        cutoffs = self.db.query(BillingUsageCutoff.starts_at, BillingUsageCutoff.ends_at,
            BillingUsageCutoff.reason).filter(BillingUsageCutoff.org_id == org_id,
            BillingUsageCutoff.state == 'needs_review').order_by(BillingUsageCutoff.starts_at.desc()).limit(101).all()
        holds = self.db.query(BillingInvoiceHold.invoice_id, BillingInvoiceHold.state,
            BillingInvoiceHold.usage_starts_at, BillingInvoiceHold.usage_ends_at).filter(
                BillingInvoiceHold.org_id == org_id, BillingInvoiceHold.state.in_(['pending', 'held'])
            ).order_by(BillingInvoiceHold.usage_starts_at.desc()).limit(101).all()
        return dict(settlements=[dict(row._mapping) for row in settlements[:100]],
            cutoffs=[dict(row._mapping) for row in cutoffs[:100]], holds=[dict(row._mapping) for row in holds[:100]],
            has_more=any(len(rows) > 100 for rows in (settlements, cutoffs, holds)))
