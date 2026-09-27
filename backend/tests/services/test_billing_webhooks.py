from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
import stripe

from app.services.billing_service import BillingService
from app.services.billing_onboarding_service import subscription_period_end
from app.services import billing_service as billing_module


def subscription(**overrides):
    return stripe.StripeObject.construct_from({
        "id": "sub_own", "customer": "cus_own", "status": "trialing",
        "trial_start": 1700000000, "trial_end": 1701209600,
        "items": {"data": [{"current_period_end": 1701209600}]},
        **overrides,
    }, None)


@pytest.fixture
def service():
    service = BillingService(MagicMock())
    service.org_repo = MagicMock()
    service.founding_offer_repo = MagicMock()
    service.conversion_repo = MagicMock()
    service.conversion_repo.get_for_org.return_value = None
    service.founding_offer_repo.get_for_org.return_value = None
    service.org_repo.get_by_stripe_customer_id.return_value = SimpleNamespace(
        id=uuid4(),
        subscription_id="sub_own", subscription_status="trialing", onboarding_deadline_at=datetime.now(timezone.utc),
        trial_starts_at=None, trial_ends_at=None, paid_at=None,
    )
    service.org_repo.lock_by_stripe_customer_id.return_value = service.org_repo.get_by_stripe_customer_id.return_value
    return service


def test_latest_stripe_state_wins_over_old_webhook(service, monkeypatch):
    monkeypatch.setattr(stripe.Subscription, "retrieve", lambda _: subscription(status="active"))
    service._handle_subscription_updated(subscription(status="trialing"))
    org = service.org_repo.get_by_stripe_customer_id.return_value
    assert org.subscription_status == "active"
    assert org.trial_ends_at == datetime.fromtimestamp(1701209600, timezone.utc)


def test_webhook_confirms_announced_conversion_immediately(service, monkeypatch):
    conversion = SimpleNamespace(
        id=uuid4(), org_id=uuid4(), subscription_id="sub_own", target_price_id="price_standard",
        effective_at=datetime(2020, 1, 1, tzinfo=timezone.utc), status="scheduled", converted_at=None,
    )
    service.conversion_repo.get_for_org.return_value = conversion
    current = subscription(status="active", metadata={"founding_conversion_id": str(conversion.id)},
                           items={"data": [{"price": {"id": "price_standard"}, "quantity": 1}]})
    monkeypatch.setattr(stripe.Subscription, "retrieve", lambda _: current)
    service._handle_subscription_updated(current)
    assert conversion.status == "converted"
    assert conversion.converted_at == conversion.effective_at


def test_commit_failure_propagates_for_stripe_retry(service, monkeypatch):
    monkeypatch.setattr(stripe.Subscription, "retrieve", lambda _: subscription())
    service.db.commit.side_effect = RuntimeError("unavailable")
    with pytest.raises(RuntimeError):
        service._handle_subscription_updated(subscription())
    service.db.rollback.assert_called_once()


def test_other_subscription_deletion_does_not_cancel_current(service):
    service._handle_subscription_deleted(subscription(id="sub_old"))
    assert service.org_repo.get_by_stripe_customer_id.return_value.subscription_status == "trialing"
    service.db.commit.assert_called_once()  # Release the lock without changing state.


def test_zero_trial_invoice_does_not_set_paid_at(service, monkeypatch):
    monkeypatch.setattr(stripe.Subscription, "retrieve", lambda _: subscription())
    service._handle_payment_succeeded(SimpleNamespace(customer="cus_own", amount_paid=0))
    assert service.org_repo.get_by_stripe_customer_id.return_value.paid_at is None


def test_failed_invoice_uses_actual_subscription_status(service, monkeypatch):
    monkeypatch.setattr(stripe.Subscription, "retrieve", lambda _: subscription(status="past_due"))
    service._handle_payment_failed(SimpleNamespace(customer="cus_own"))
    assert service.org_repo.get_by_stripe_customer_id.return_value.subscription_status == "past_due"


def test_legacy_period_supported():
    sub = subscription(items={"data": [{}]}, current_period_end=1701209600)
    assert subscription_period_end(sub) == datetime.fromtimestamp(1701209600, timezone.utc)


@pytest.mark.parametrize("invoice_sub,should_record", [("sub_own", True), ("sub_unrelated", False)])
def test_only_paid_own_subscription_starts_founding_protection(service, monkeypatch, invoice_sub, should_record):
    monkeypatch.setattr(stripe.Subscription, "retrieve", lambda _: subscription(status="active"))
    founding = MagicMock()
    monkeypatch.setattr(billing_module, "FoundingOfferService", founding)
    invoice = stripe.StripeObject.construct_from({
        "customer": "cus_own", "amount_paid": 20000,
        "parent": {"subscription_details": {"subscription": invoice_sub}},
    }, None)
    service._handle_payment_succeeded(invoice)
    if should_record:
        org = service.org_repo.get_by_stripe_customer_id.return_value
        founding.return_value.record_paid_period.assert_called_once_with(org.id, datetime.fromtimestamp(1701209600, timezone.utc))
    else:
        founding.assert_not_called()


def test_portal_cancellation_records_forfeiture(service, monkeypatch):
    offer = SimpleNamespace(forfeited_at=None)
    service.founding_offer_repo.get_for_org.return_value = offer
    monkeypatch.setattr(stripe.Subscription, "retrieve", lambda _: subscription(cancel_at_period_end=True))
    service._handle_subscription_updated(subscription())
    assert offer.forfeited_at is not None
