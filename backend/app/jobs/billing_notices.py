import logging
from datetime import datetime, timedelta, timezone
from app.core.config import settings
from app.db.session import SessionLocal
from app.repositories.billing_notice_repository import BillingNoticeRepository
from app.services.billing_notice_service import BillingNoticeService

logger = logging.getLogger(__name__)


def send_billing_trial_reminders():
    if not settings.billing_notifications_enabled:
        return
    now = datetime.now(timezone.utc)
    with SessionLocal() as db:
        ids = BillingNoticeRepository(db).trial_org_ids(now, now + timedelta(days=3))
    for org_id in ids:
        try:
            with SessionLocal() as db:
                BillingNoticeService(db).trial_reminder(org_id, now)
        except Exception:
            logger.warning("Trial reminder failed for agency %s; next scan will retry", org_id)
