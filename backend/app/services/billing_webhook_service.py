from datetime import datetime, timedelta, timezone
from uuid import uuid4
import stripe
from sqlalchemy.exc import IntegrityError
from app.core.exceptions import AppError
from app.core.stripe_objects import stripe_field
from app.models.billing_webhook import BillingWebhook
from app.repositories.billing_webhook_repository import BillingWebhookRepository


SUPPORTED_EVENTS = {
    "checkout.session.completed",
    "invoice.created", "customer.subscription.created", "customer.subscription.updated",
    "customer.subscription.deleted", "invoice.payment_failed", "invoice.payment_succeeded",
    "invoice.paid", "invoice.voided", "invoice.marked_uncollectible",
}


class BillingWebhookService:
    """At-least-once processing; handlers must remain safe to repeat after a crash."""
    def __init__(self, db):
        self.db = db
        self.webhook_repo = BillingWebhookRepository(db)

    def receive(self, event):
        if event["type"] not in SUPPORTED_EVENTS:
            return {"received": True}
        obj = event["data"]["object"]
        customer = stripe_field(obj, "customer")
        if not customer:  # Non-customer invoices cannot belong to an agency.
            return {"received": True}
        customer = customer if isinstance(customer, str) else customer["id"]
        now = datetime.now(timezone.utc)
        identity = dict(event_type=event["type"], object_id=obj["id"],
                        customer_id=customer, livemode=event["livemode"])
        try:
            if self.webhook_repo.get(event["id"]) is None:
                self.webhook_repo.add(BillingWebhook(event_id=event["id"], **identity,
                    state="pending", attempts=0, received_at=now, updated_at=now, next_attempt_at=now))
            self.db.commit()
        except IntegrityError:
            self.db.rollback()  # Another delivery inserted the same receipt.
        receipt = self.webhook_repo.get(event["id"])
        if receipt is None or any(getattr(receipt, key) != value for key, value in identity.items()):
            self.db.rollback()
            raise AppError(409, "WEBHOOK_IDENTITY_MISMATCH", "Webhook identity does not match its receipt")
        self.db.commit()
        self.process(event["id"])
        return {"received": True}

    def process(self, event_id, now=None):
        now = now or datetime.now(timezone.utc)
        token = uuid4()
        if not self.webhook_repo.claim(event_id, token, now, now + timedelta(minutes=5)):
            receipt = self.webhook_repo.get(event_id)
            completed = receipt is not None and receipt.state == "completed"
            self.db.commit()
            if completed:
                return
            raise AppError(503, "WEBHOOK_RETRY_PENDING", "Webhook processing is pending; retry later")
        self.db.commit()  # Durable claim precedes any handler commits or Stripe calls.
        receipt = self.webhook_repo.get(event_id)
        event_type, object_id, customer_id, livemode, attempts = (
            receipt.event_type, receipt.object_id, receipt.customer_id, receipt.livemode, receipt.attempts)
        self.db.commit()
        try:
            # Retrieve current objects, not expired Event payloads. Old deliveries
            # must never restore an old subscription/payment status.
            resource = (stripe.checkout.Session if event_type == "checkout.session.completed" else
                        stripe.Subscription if event_type.startswith("customer.subscription.") else stripe.Invoice)
            obj = resource.retrieve(object_id)
            if obj.id != object_id or stripe_field(obj, "customer") != customer_id or stripe_field(obj, "livemode") != livemode:
                raise ValueError("Stripe object identity mismatch")
            from app.services.billing_service import BillingService
            BillingService(self.db).dispatch_webhook(event_type, obj)
            if not self.webhook_repo.finish(event_id, token, datetime.now(timezone.utc)):
                raise AppError(503, "WEBHOOK_LEASE_LOST", "Webhook recovery is in progress")
            self.db.commit()
        except Exception as exc:
            self.db.rollback()
            finished = datetime.now(timezone.utc)
            self.webhook_repo.finish(event_id, token, finished, error=type(exc).__name__,
                next_attempt_at=finished + timedelta(minutes=min(360, 2 ** min(attempts, 9))))
            self.db.commit()
            raise AppError(503, "WEBHOOK_PROCESSING_FAILED", "Webhook processing failed; retry later") from exc
