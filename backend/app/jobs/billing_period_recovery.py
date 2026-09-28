import logging
from app.core.config import settings
from app.db.session import SessionLocal
from app.repositories.billing_cutoff_repository import BillingCutoffRepository
from app.services.billing_cutoff_service import BillingCutoffService
from app.services.billing_period_recovery_service import BillingPeriodRecoveryService

logger = logging.getLogger(__name__)


def recover_billing_periods():
    if not settings.billing_onboarding_enabled:
        return
    with SessionLocal() as db:
        org_ids = BillingCutoffRepository(db).organizations()
    for org_id in org_ids:
        try:
            with SessionLocal() as db:
                BillingCutoffService(db).capture_due(org_id)
            with SessionLocal() as db:
                BillingPeriodRecoveryService(db).recover(org_id)
        except Exception:
            logger.exception("Unable to recover billing periods for organization %s", org_id)
