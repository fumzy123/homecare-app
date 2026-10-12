import logging

from app.core.config import settings
from app.db.session import SessionLocal
from app.services.billing_onboarding_service import BillingOnboardingService
from app.repositories.billing_agreement_repository import BillingAgreementRepository

logger = logging.getLogger(__name__)


def request_due_trials():
    """Recover customer-authorized purchases; never create trials from onboarding."""
    if not settings.billing_onboarding_enabled:
        return
    with SessionLocal() as db:
        pending = BillingAgreementRepository(db).pending_org_ids()
    for org_id in pending:
        try:
            with SessionLocal() as db:
                BillingOnboardingService(db, org_id=org_id).process_activation()
        except Exception:
            logger.exception("Unable to activate trial for organization %s", org_id)
