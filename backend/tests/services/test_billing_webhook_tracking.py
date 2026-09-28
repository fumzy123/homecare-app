import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock
from uuid import uuid4
import pytest
import stripe
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.core.exceptions import AppError
from app.models.billing_webhook import BillingWebhook
from app.services.billing_webhook_service import BillingWebhookService
from app.services.billing_service import BillingService
from app.services.billing_operator_service import BillingOperatorService


def event(event_id="evt_one", kind="invoice.payment_failed", **overrides):
    return {"id": event_id, "type": kind, "livemode": False,
            "data": {"object": {"id": "in_one", "customer": "cus_one", "private": "do-not-store"}}, **overrides}


@pytest.fixture
def setup(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'webhooks.db'}")
    BillingWebhook.__table__.create(engine)
    obj = stripe.StripeObject.construct_from({"id": "in_one", "customer": "cus_one", "livemode": False, "status": "paid"}, None)
    retrieve = MagicMock(return_value=obj)
    dispatch = MagicMock()
    monkeypatch.setattr(stripe.Invoice, "retrieve", retrieve)
    monkeypatch.setattr(BillingService, "dispatch_webhook", dispatch)
    yield engine, retrieve, dispatch
    engine.dispose()


def test_duplicate_delivery_and_restart_do_not_dispatch_completed_receipt(setup):
    engine, retrieve, dispatch = setup
    with Session(engine) as db:
        assert BillingWebhookService(db).receive(event()) == {"received": True}
    with Session(engine) as db:
        BillingWebhookService(db).receive(event())
        row = db.get(BillingWebhook, "evt_one")
        assert row.state == "completed" and row.attempts == 1 and row.completed_at
        assert "do-not-store" not in str(row.__dict__)
    assert retrieve.call_count == dispatch.call_count == 1
    assert dispatch.call_args.args[1].status == "paid"  # Current state, not original failure.


def test_failure_is_persisted_and_recoverable_after_restart(setup):
    engine, retrieve, dispatch = setup
    dispatch.side_effect = RuntimeError("secret remote response")
    with Session(engine) as db:
        with pytest.raises(AppError) as error:
            BillingWebhookService(db).receive(event())
        assert error.value.status_code == 503
        row = db.get(BillingWebhook, "evt_one")
        assert row.state == "failed" and row.error_code == "RuntimeError" and row.completed_at is None
        assert row.attempts == 1 and row.lease_token is None
    dispatch.side_effect = None
    with Session(engine) as db:
        service = BillingWebhookService(db)
        future = datetime.now(timezone.utc) + timedelta(minutes=10)
        assert service.webhook_repo.due_ids(future) == ["evt_one"]
        service.process("evt_one", future)
        assert db.get(BillingWebhook, "evt_one").state == "completed"
    assert dispatch.call_count == 2


def test_only_one_claim_and_expired_lease_can_be_recovered(setup):
    engine, retrieve, dispatch = setup
    now = datetime.now(timezone.utc)
    first, second = uuid4(), uuid4()
    with Session(engine) as db:
        db.add(BillingWebhook(event_id="evt_one", event_type="invoice.created", object_id="in_one", customer_id="cus_one",
            livemode=False, state="pending", attempts=0, received_at=now, updated_at=now, next_attempt_at=now))
        db.commit()
        repo = BillingWebhookService(db).webhook_repo
        assert repo.claim("evt_one", first, now, now + timedelta(minutes=5))
        db.commit()
    with Session(engine) as db:
        service = BillingWebhookService(db)
        with pytest.raises(AppError) as error:
            service.process("evt_one", now)
        assert error.value.status_code == 503
        dispatch.assert_not_called()
        assert service.webhook_repo.claim("evt_one", second, now + timedelta(minutes=6), now + timedelta(minutes=11))
        db.commit()
        assert not service.webhook_repo.finish("evt_one", first, now)
        db.commit()
        service.process("evt_one", now + timedelta(minutes=12))
        assert db.get(BillingWebhook, "evt_one").state == "completed"


def test_object_identity_mismatch_is_not_dispatched(setup):
    engine, retrieve, dispatch = setup
    retrieve.return_value.customer = "cus_other"
    with Session(engine) as db:
        with pytest.raises(AppError):
            BillingWebhookService(db).receive(event())
        assert db.get(BillingWebhook, "evt_one").state == "failed"
    dispatch.assert_not_called()


def test_reused_event_id_cannot_change_identity(setup):
    engine, retrieve, dispatch = setup
    with Session(engine) as db:
        service = BillingWebhookService(db)
        service.receive(event())
        with pytest.raises(AppError) as error:
            service.receive(event(kind="invoice.created"))
        assert error.value.code == "WEBHOOK_IDENTITY_MISMATCH"
    assert dispatch.call_count == 1


def test_invalid_signature_and_unhandled_events_do_not_write_receipts(monkeypatch):
    db = MagicMock()
    monkeypatch.setattr(stripe.Webhook, "construct_event", MagicMock(side_effect=stripe.SignatureVerificationError("invalid", "signature")))
    with pytest.raises(AppError) as error:
        asyncio.run(BillingService(db).handle_webhook(b"payload", "signature"))
    assert error.value.status_code == 400
    assert BillingWebhookService(db).receive(event(kind="irrelevant.event")) == {"received": True}
    db.add.assert_not_called()
    db.commit.assert_not_called()


def test_operator_feed_requires_allowlist_and_does_not_expose_customer(setup, monkeypatch):
    from types import SimpleNamespace
    from app.core.config import settings
    engine, retrieve, dispatch = setup
    dispatch.side_effect = RuntimeError("secret")
    with Session(engine) as db:
        with pytest.raises(AppError):
            BillingWebhookService(db).receive(event())
        user = SimpleNamespace(id=uuid4())
        with pytest.raises(AppError):
            BillingOperatorService(db, user).webhooks()
        monkeypatch.setattr(settings, "billing_operator_user_ids", [str(user.id)])
        feed = BillingOperatorService(db, user).webhooks()
        assert feed["events"][0]["event_id"] == "evt_one"
        assert "cus_one" not in str(feed) and "secret" not in str(feed)
