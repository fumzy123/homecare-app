import logging
from datetime import datetime, timezone
from app.core.config import settings
from app.db.session import SessionLocal
from app.repositories.billing_finalization_repository import BillingFinalizationRepository
from app.services.billing_finalization_service import BillingFinalizationService

logger = logging.getLogger(__name__)


def finalize_due_billing_periods():
    if not settings.billing_onboarding_enabled or not settings.billing_usage_finalization_enabled:
        return
    now = datetime.now(timezone.utc)
    with SessionLocal() as db:
        due = BillingFinalizationRepository(db).due_periods(now)
    for org_id, period_id in due:
        try:
            with SessionLocal() as db:
                BillingFinalizationService(db).finalize(org_id, period_id)
        except Exception:
            # Keep the period pending for retry; never store a zero on failure.
            logger.exception("Unable to finalize billing period %s for organization %s", period_id, org_id)
