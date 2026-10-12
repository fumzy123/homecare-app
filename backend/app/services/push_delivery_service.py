from datetime import datetime, timedelta, timezone
from app.domain.push import push_message
from app.repositories.push_delivery_repository import PushDeliveryRepository


class PushDeliveryService:
    def __init__(self, db, client, app_ids):
        self.db, self.client, self.app_ids = db, client, app_ids
        self.push_delivery_repo = PushDeliveryRepository(db)

    @staticmethod
    def _finish(delivery, status, code=None):
        delivery.status, delivery.error_code = status, code
        delivery.token = None

    def deliver_one(self, now=None):
        now = now or datetime.now(timezone.utc)
        try:
            delivery = self.push_delivery_repo.next_due(now, self.app_ids)
            if not delivery:
                self.db.rollback()
                return False
            expiry = delivery.expires_at.replace(tzinfo=timezone.utc)
            if expiry <= now:
                self._finish(delivery, 'expired', 'delivery_expired')
            elif not self.push_delivery_repo.current_device(delivery):
                self._finish(delivery, 'skipped', 'registration_changed')
            else:
                self._attempt(delivery, now)
            self.db.commit()
            return True
        except Exception:
            self.db.rollback()
            raise

    def _attempt(self, delivery, now):
        checking_receipt = delivery.status == 'receipt'
        if checking_receipt:
            result = self.client.receipt(delivery.ticket_id)
        else:
            delivery.attempts += 1
            result = self.client.send(push_message(delivery))
        delivery.error_code = result.code
        if result.code == 'DeviceNotRegistered':
            self.push_delivery_repo.invalidate_token(delivery)
        if result.status in {'failed', 'delivered'}:
            self._finish(delivery, result.status, result.code)
        elif result.status == 'receipt':
            delivery.status, delivery.ticket_id = 'receipt', result.ticket_id
            delivery.next_attempt_at = now + timedelta(minutes=15)
        elif checking_receipt:
            # Once Expo accepted the message, poll only; never resend for a missing receipt.
            delivery.next_attempt_at = now + timedelta(minutes=15)
        elif delivery.attempts >= 5:
            self._finish(delivery, 'failed', 'retry_limit')
        else:
            delivery.next_attempt_at = now + timedelta(seconds=60 * 2 ** (delivery.attempts - 1))
