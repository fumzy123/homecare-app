import logging
from datetime import datetime, timedelta, timezone

from app.core.config import settings
from app.db.session import SessionLocal
from app.repositories.founding_conversion_repository import FoundingConversionRepository
from app.services.founding_conversion_service import FoundingConversionService

logger = logging.getLogger(__name__)


def process_founding_conversions():
    if not settings.billing_onboarding_enabled:
        return
    now = datetime.now(timezone.utc)
    with SessionLocal() as db:
        org_ids = FoundingConversionRepository(db).pending_org_ids(now + timedelta(days=45))
    for org_id in org_ids:
        try:
            with SessionLocal() as db:
                FoundingConversionService(db).process(org_id, now=now)
        except Exception:
            logger.exception("Unable to process founding conversion for organization %s", org_id)
