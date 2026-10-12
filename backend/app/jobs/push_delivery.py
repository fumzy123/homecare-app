import logging
from app.core.config import settings
from app.db.session import SessionLocal
from app.services.expo_push_client import ExpoPushClient
from app.services.push_delivery_service import PushDeliveryService

logger = logging.getLogger(__name__)


def deliver_worker_pushes():
    if not settings.push_delivery_enabled or not settings.push_allowed_app_ids:
        return
    db = SessionLocal()
    client = ExpoPushClient(settings.expo_push_access_token)
    try:
        service = PushDeliveryService(db, client, settings.push_allowed_app_ids)
        for _ in range(50):
            if not service.deliver_one():
                break
    except Exception:
        # No exception text: database/HTTP exceptions may contain device tokens.
        logger.error('Worker push delivery job failed; pending work will be retried')
    finally:
        db.close()
        client.close()
