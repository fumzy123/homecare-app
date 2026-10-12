from sqlalchemy import or_, update
from app.models.billing_webhook import BillingWebhook


class BillingWebhookRepository:
    def __init__(self, db):
        self.db = db

    def get(self, event_id):
        return self.db.get(BillingWebhook, event_id, populate_existing=True)

    def add(self, receipt):
        self.db.add(receipt)
        self.db.flush()

    def claim(self, event_id, token, now, until):
        return self.db.execute(update(BillingWebhook).where(
            BillingWebhook.event_id == event_id, BillingWebhook.state != "completed",
            BillingWebhook.next_attempt_at <= now,
            or_(BillingWebhook.lease_until.is_(None), BillingWebhook.lease_until <= now),
        ).values(state="processing", lease_token=token, lease_until=until,
                 attempts=BillingWebhook.attempts + 1, updated_at=now)).rowcount == 1

    def finish(self, event_id, token, now, *, error=None, next_attempt_at=None):
        return self.db.execute(update(BillingWebhook).where(
            BillingWebhook.event_id == event_id, BillingWebhook.lease_token == token,
        ).values(state="failed" if error else "completed", error_code=error,
                 completed_at=None if error else now, updated_at=now,
                 lease_token=None, lease_until=None, next_attempt_at=next_attempt_at or now)).rowcount == 1

    def due_ids(self, now, limit=100):
        return [row[0] for row in self.db.query(BillingWebhook.event_id).filter(
            BillingWebhook.state != "completed", BillingWebhook.next_attempt_at <= now,
            or_(BillingWebhook.lease_until.is_(None), BillingWebhook.lease_until <= now),
        ).order_by(BillingWebhook.next_attempt_at, BillingWebhook.event_id).limit(limit).all()]

    def failures(self, limit=101):
        return self.db.query(BillingWebhook).filter(BillingWebhook.state != "completed").order_by(
            BillingWebhook.received_at, BillingWebhook.event_id).limit(limit).all()
