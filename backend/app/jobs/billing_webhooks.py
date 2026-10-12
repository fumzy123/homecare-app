import logging
from datetime import datetime, timezone
from app.db.session import SessionLocal
from app.repositories.billing_webhook_repository import BillingWebhookRepository
from app.services.billing_webhook_service import BillingWebhookService

logger = logging.getLogger(__name__)


def retry_billing_webhooks():
    with SessionLocal() as db:
        ids = BillingWebhookRepository(db).due_ids(datetime.now(timezone.utc))
    for event_id in ids:
        try:
            with SessionLocal() as db:
                BillingWebhookService(db).process(event_id)
        except Exception:
            # Do not log Stripe response bodies/payment details.
            logger.warning("Billing webhook %s remains pending; inspect its durable receipt", event_id)
