import logging
from app.db.session import SessionLocal
from app.repositories.billing_settlement_repository import BillingSettlementRepository
from app.repositories.billing_cutoff_repository import BillingCutoffRepository
from app.services.billing_settlement_service import (BillingSettlementService, SettlementBusy,
                                                     SettlementReviewRequired, settlement_enabled)
from app.services.billing_invoice_hold_service import BillingInvoiceHoldService
from app.services.stripe_usage_gateway import StripeUsageGateway
from app.services.billing_annual_service import BillingAnnualService
import stripe

logger = logging.getLogger(__name__)


def settle_billing_usage():
    if not settlement_enabled():
        return
    # Recover missed invoice.created delivery while renewal invoices are still drafts.
    with SessionLocal() as db:
        org_ids = BillingCutoffRepository(db).organizations()
    for org_id in org_ids:
        try:
            with SessionLocal() as db:
                org = BillingCutoffRepository(db).lock_organization(org_id)
                customer, subscription = org.stripe_customer_id, org.subscription_id
                db.commit()
                for invoice in stripe.Invoice.list(customer=customer, subscription=subscription, status="draft", limit=100).auto_paging_iter():
                    BillingInvoiceHoldService(db).hold(invoice.id)
        except Exception:
            logger.exception("Unable to hold usage renewal for agency %s", org_id)
    with SessionLocal() as db:
        repo = BillingSettlementRepository(db)
        periods = set(repo.unprepared_periods()) | set(repo.adjustment_periods())
    for org_id, period_id in periods:
        try:
            with SessionLocal() as db:
                BillingSettlementService(db).prepare(org_id, period_id)
        except Exception:
            logger.exception("Unable to prepare usage settlement for period %s", period_id)
    with SessionLocal() as db:
        annual = BillingSettlementRepository(db).annual_groups()
    for org_id, invoice_id, line_id in annual:
        try:
            with SessionLocal() as db:
                BillingAnnualService(db).prepare_year(org_id, invoice_id, line_id)
        except Exception:
            logger.exception("Annual usage collection needs retry/review for agency %s", org_id)
    with SessionLocal() as db:
        ids = BillingSettlementRepository(db).work_ids()
    for sid in ids:
        with SessionLocal() as db:
            service = BillingSettlementService(db)
            try:
                claim = service.claim(sid)
            except Exception:
                logger.exception("Unable to claim usage settlement %s", sid)
                continue
            if claim is None:
                continue
            op, token = claim
            try:
                result = StripeUsageGateway(service, op, token).run()
                service.finish(sid, token, **result)
            except SettlementBusy:
                db.rollback()  # Another worker owns recovery of the expired lease.
            except Exception as exc:
                db.rollback()
                state = "needs_review" if isinstance(exc, (SettlementReviewRequired, stripe.InvalidRequestError)) else "processing"
                try:
                    service.finish(sid, token, state, error=str(exc) if isinstance(exc, SettlementReviewRequired) else type(exc).__name__)
                except SettlementBusy:
                    pass
                except Exception:
                    db.rollback()
                    logger.exception("Unable to record settlement failure %s", sid)
                logger.exception("Usage settlement %s requires retry/review", sid)
