import logging
from datetime import datetime, timezone

from app.core.config import settings
from app.db.session import SessionLocal
from app.repositories.trial_activation_repository import TrialActivationRepository
from app.services.trial_activation_service import TrialActivationService
from app.services.billing_onboarding_service import BillingOnboardingService
from app.repositories.billing_agreement_repository import BillingAgreementRepository

logger = logging.getLogger(__name__)


def request_due_trials():
    """Queue due requests, with per-agency transactions and restart catch-up."""
    if not settings.billing_onboarding_enabled:
        return
    now = datetime.now(timezone.utc)
    with SessionLocal() as db:
        org_ids = TrialActivationRepository(db).due_org_ids(now)
    for org_id in org_ids:
        try:
            with SessionLocal() as db:
                TrialActivationService(db).request_start(org_id, now=now)
        except Exception:
            logger.exception("Unable to queue trial activation for organization %s", org_id)
    with SessionLocal() as db:
        pending = BillingAgreementRepository(db).pending_org_ids()
    for org_id in pending:
        try:
            with SessionLocal() as db:
                BillingOnboardingService(db, org_id=org_id).process_activation()
        except Exception:
            logger.exception("Unable to activate trial for organization %s", org_id)
