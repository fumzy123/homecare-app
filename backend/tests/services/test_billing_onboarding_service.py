from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
import stripe

from app.core.config import settings
from app.core.exceptions import AppError
from app.domain.billing_consent import CONSENT_VERSION
from app.services import billing_onboarding_service as module


@pytest.fixture
def state(monkeypatch):
    now = datetime.now(timezone.utc).replace(microsecond=0)
    monkeypatch.setattr(settings, "billing_onboarding_enabled", True)
    monkeypatch.setattr(settings, "stripe_standard_monthly_v1_price_id", "price_month")
    monkeypatch.setattr(settings, "stripe_standard_annual_v1_price_id", "price_year")
    remote = MagicMock()
    monkeypatch.setattr(module, "stripe", remote)
    service = module.BillingOnboardingService(MagicMock(), SimpleNamespace(id=uuid4()), uuid4())
    service.trial_activation_repo = MagicMock()
    service.agreement_repo = MagicMock()
    service.conversion_repo = MagicMock()
    service.conversion_repo.get_for_org.return_value = None
    service.founding_offer_repo = MagicMock()
    service.founding_offer_repo.get_for_org.return_value = None
    org = SimpleNamespace(
        billing_timezone="UTC",
        id=service.org_id, onboarding_deadline_at=now + timedelta(days=20),
        onboarding_completed_at=now, stripe_customer_id="cus_own", subscription_id=None,
        trial_starts_at=None, trial_ends_at=None, subscription_status=None,
        subscription_current_period_end=None,
    )
    agreement = SimpleNamespace(
        id=uuid4(), org_id=org.id, plan_code="standard", plan_version=1,
        base_interval="month", stripe_price_id="price_month", canceled_at=None,
        consent_version=CONSENT_VERSION,
        customer_attempted_at=None, checkout_session_id=None, payment_method_id="pm_own",
    )
    request = SimpleNamespace(
        id=uuid4(), starts_at=now, ends_at=now + timedelta(days=14),
        status="pending", stripe_attempted_at=None,
    )
    sub = stripe.StripeObject.construct_from({
        "id": "sub_own", "status": "trialing",
        "trial_start": int(now.timestamp()), "trial_end": int(request.ends_at.timestamp()),
        "metadata": {"trial_activation_id": str(request.id)},
        "items": {"data": [{"current_period_end": int(request.ends_at.timestamp())}]},
    }, None)
    remote.Subscription.create.return_value = sub
    remote.Subscription.list.return_value.auto_paging_iter.side_effect = lambda: iter([])
    service.trial_activation_repo.lock_organization.return_value = org
    service.trial_activation_repo.get_for_org.return_value = request
    service.agreement_repo.get_for_org.return_value = agreement
    return SimpleNamespace(service=service, org=org, agreement=agreement, request=request, remote=remote, sub=sub, now=now)


def test_activation_uses_authorized_price_card_and_fixed_trial_end(state):
    state.service.process_activation(now=state.now)
    args = state.remote.Subscription.create.call_args.kwargs
    assert args["trial_end"] == int(state.request.ends_at.timestamp())
    assert args["items"] == [{"price": "price_month"}]
    assert args["default_payment_method"] == "pm_own"
    assert args["idempotency_key"] == f"trial-activation-{state.request.id}"
    assert state.org.subscription_id == "sub_own"
    assert state.org.trial_ends_at == state.request.ends_at
    assert state.request.status == "activated"
    state.service.process_activation(now=state.now)
    state.remote.Subscription.create.assert_called_once()


def test_missing_timezone_blocks_card_authorization(state):
    state.org.billing_timezone = None
    with pytest.raises(AppError) as error:
        state.service.setup_card("month", CONSENT_VERSION)
    assert error.value.code == "TIMEZONE_REQUIRED"
    state.remote.checkout.Session.create.assert_not_called()


def test_missing_timezone_blocks_new_trial_subscription(state):
    state.org.billing_timezone = None
    state.service.process_activation(now=state.now)
    assert state.request.status == "needs_review"
    state.remote.Subscription.create.assert_not_called()


def test_remote_success_after_local_failure_is_reconciled(state):
    state.remote.Subscription.list.return_value.auto_paging_iter.side_effect = lambda: iter([state.sub])
    state.request.stripe_attempted_at = state.now - timedelta(days=3)
    state.service.process_activation(now=state.now)
    state.remote.Subscription.create.assert_not_called()
    assert state.org.subscription_id == "sub_own"


def test_uncertain_attempt_past_idempotency_window_needs_review(state):
    state.request.stripe_attempted_at = state.now - timedelta(hours=24)
    state.service.process_activation(now=state.now)
    assert state.request.status == "needs_review"
    state.remote.Subscription.create.assert_not_called()


def test_retry_within_window_reuses_key(state):
    state.request.stripe_attempted_at = state.now - timedelta(hours=1)
    state.service.process_activation(now=state.now)
    assert state.remote.Subscription.create.call_args.kwargs["idempotency_key"] == f"trial-activation-{state.request.id}"


@pytest.mark.parametrize("reason", ["card", "consent", "canceled", "expired", "existing"])
def test_activation_never_charges_without_preconditions(state, reason):
    if reason == "card":
        state.agreement.payment_method_id = None
    elif reason == "consent":
        state.service.agreement_repo.get_for_org.return_value = None
    elif reason == "canceled":
        state.agreement.canceled_at = state.now
    elif reason == "expired":
        state.request.ends_at = state.now
    else:
        state.org.subscription_id = "sub_other"
    state.service.process_activation(now=state.now)
    state.remote.Subscription.create.assert_not_called()


def test_unrelated_subscription_blocks_second_subscription(state):
    other = SimpleNamespace(id="sub_other", status="active", metadata={})
    state.remote.Subscription.list.return_value.auto_paging_iter.side_effect = lambda: iter([other])
    state.service.process_activation(now=state.now)
    assert state.request.status == "needs_review"
    state.remote.Subscription.create.assert_not_called()


def test_cancel_reconciles_subscription_even_if_local_id_missing(state):
    state.remote.Subscription.list.return_value.auto_paging_iter.side_effect = lambda: iter([state.sub])
    state.service.cancel()
    state.remote.Subscription.modify.assert_called_once_with("sub_own", cancel_at_period_end=True)
    assert state.agreement.canceled_at is not None
    assert state.request.status == "canceled"


def test_setup_is_charge_free_and_records_server_selected_terms(state):
    state.service.agreement_repo.get_for_org.return_value = None
    state.service.agreement_repo.add.side_effect = lambda agreement: setattr(state.service.agreement_repo.get_for_org, "return_value", agreement)
    state.remote.Price.retrieve.return_value = SimpleNamespace(
        active=True, currency="cad", unit_amount=30000,
        recurring=SimpleNamespace(interval="month", interval_count=1),
    )
    state.remote.checkout.Session.create.return_value = SimpleNamespace(id="cs_setup", url="https://checkout.stripe.com/test")
    result = state.service.setup_card("month", CONSENT_VERSION)
    agreement = state.service.agreement_repo.add.call_args.args[0]
    assert agreement.accepted_by == state.service.current_user.id
    assert agreement.plan_version == 1
    assert agreement.stripe_price_id == "price_month"
    assert state.remote.checkout.Session.create.call_args.kwargs["mode"] == "setup"
    state.remote.Subscription.create.assert_not_called()
    assert result["url"].startswith("https://checkout.stripe.com/")


def test_wrong_currency_price_is_rejected(state):
    state.service.agreement_repo.get_for_org.return_value = None
    state.remote.Price.retrieve.return_value = SimpleNamespace(active=True, currency="usd")
    with pytest.raises(AppError) as error:
        state.service.setup_card("month", CONSENT_VERSION)
    assert error.value.code == "PRICE_MISMATCH"
    state.remote.checkout.Session.create.assert_not_called()


def test_foreign_setup_intent_cannot_authorize_payment(state):
    state.agreement.checkout_session_id = "cs_own"
    state.remote.checkout.Session.retrieve.return_value = SimpleNamespace(status="complete", mode="setup", customer="cus_own", setup_intent="seti_foreign")
    state.remote.SetupIntent.retrieve.return_value = SimpleNamespace(status="succeeded", customer="cus_other")
    with pytest.raises(AppError) as error:
        state.service.confirm_card()
    assert error.value.code == "CARD_NOT_READY"


def test_confirm_card_uses_own_completed_setup(state):
    state.agreement.checkout_session_id = "cs_own"
    state.remote.checkout.Session.retrieve.return_value = SimpleNamespace(status="complete", mode="setup", customer="cus_own", setup_intent="seti_own")
    state.remote.SetupIntent.retrieve.return_value = SimpleNamespace(status="succeeded", customer="cus_own", payment_method="pm_new")
    state.service.confirm_card()
    assert state.agreement.payment_method_id == "pm_new"


def test_api_failure_is_retried_not_silently_activated(state):
    state.request.stripe_attempted_at = state.now
    state.remote.Subscription.create.side_effect = RuntimeError("timeout")
    with pytest.raises(RuntimeError):
        state.service.process_activation(now=state.now)
    assert state.request.status == "pending"
    state.service.db.rollback.assert_called_once()


def test_summary_no_countdown_during_onboarding(state):
    summary = state.service.summary(state.org, now=state.now)
    assert summary["is_onboarding"]
    assert summary["trial_days_left"] == 0
    assert summary["trial_ends_at"] is None


def test_summary_uses_confirmed_trial_end_and_rounds_up(state):
    state.org.subscription_status = "trialing"
    state.org.trial_starts_at = state.now
    state.org.trial_ends_at = state.now + timedelta(days=13, hours=23)
    summary = state.service.summary(state.org, now=state.now)
    assert summary["trial_days_left"] == 14
    assert not summary["is_onboarding"]


def test_price_interval_and_consent_cannot_be_arbitrary(state):
    with pytest.raises(AppError):
        state.service.setup_card("founding", CONSENT_VERSION)
    with pytest.raises(AppError):
        state.service.setup_card("month", "old-consent")
    state.remote.checkout.Session.create.assert_not_called()


def test_reserved_founder_gets_only_monthly_offer_and_correct_usage_rate(state):
    state.service.agreement_repo.get_for_org.return_value = None
    state.service.founding_offer_repo.get_for_org.return_value = SimpleNamespace(released_at=None, forfeited_at=None)
    options = state.service.options()
    assert len(options["plans"]) == 1
    assert options["plans"][0]["code"] == "founding"
    assert options["plans"][0]["base_amount_cents"] == 20000
    assert options["plans"][0]["additional_client_amount_cents"] == 400
    with pytest.raises(AppError):
        state.service.setup_card("year", options["consent_version"])


def test_browser_cannot_claim_founding_without_allocation(state):
    from app.domain.billing_consent import FOUNDING_CONSENT_VERSION
    state.service.agreement_repo.get_for_org.return_value = None
    with pytest.raises(AppError) as error:
        state.service.setup_card("month", FOUNDING_CONSENT_VERSION)
    assert error.value.code == "INVALID_TERMS"
    state.remote.checkout.Session.create.assert_not_called()


def test_founder_setup_uses_server_founding_price(state, monkeypatch):
    from app.domain.billing_consent import FOUNDING_CONSENT_VERSION
    monkeypatch.setattr(settings, "stripe_founding_monthly_v1_price_id", "price_founding")
    state.service.agreement_repo.get_for_org.return_value = None
    state.service.founding_offer_repo.get_for_org.return_value = SimpleNamespace(released_at=None, forfeited_at=None)
    state.service.agreement_repo.add.side_effect = lambda agreement: setattr(state.service.agreement_repo.get_for_org, "return_value", agreement)
    state.remote.Price.retrieve.return_value = SimpleNamespace(active=True, currency="cad", unit_amount=20000, recurring=SimpleNamespace(interval="month", interval_count=1))
    state.remote.checkout.Session.create.return_value = SimpleNamespace(id="cs_founder", url="https://checkout.stripe.com/test")
    state.service.setup_card("month", FOUNDING_CONSENT_VERSION)
    agreement = state.service.agreement_repo.add.call_args.args[0]
    assert agreement.plan_code == "founding"
    assert agreement.stripe_price_id == "price_founding"


def test_cancel_records_founder_forfeiture(state):
    offer = SimpleNamespace(forfeited_at=None)
    state.service.founding_offer_repo.get_for_org.return_value = offer
    state.service.cancel()
    assert offer.forfeited_at == state.agreement.canceled_at


def test_converted_summary_uses_standard_without_rewriting_consent(state):
    state.agreement.plan_code = "founding"
    state.service.conversion_repo.get_for_org.return_value = SimpleNamespace(
        status="converted", target_plan_version=1, notice_at=state.now - timedelta(days=40),
        effective_at=state.now, base_amount_cents=30000, additional_client_amount_cents=500, included_clients=10,
    )
    summary = state.service.summary(state.org, now=state.now)
    assert summary["plan_code"] == "standard"
    assert summary["base_amount_cents"] == 30000
    assert summary["additional_client_amount_cents"] == 500
    assert state.agreement.plan_code == "founding"


def test_pending_notice_does_not_change_current_plan(state):
    state.agreement.plan_code = "founding"
    state.service.conversion_repo.get_for_org.return_value = SimpleNamespace(
        status="scheduled", target_plan_version=1, notice_at=state.now,
        effective_at=state.now + timedelta(days=40), base_amount_cents=30000, additional_client_amount_cents=500, included_clients=10,
    )
    summary = state.service.summary(state.org, now=state.now)
    assert summary["base_amount_cents"] == 20000
    assert summary["additional_client_amount_cents"] == 400
    assert summary["founding_conversion"]["base_amount_cents"] == 30000


def test_cancel_releases_schedule_before_stopping_renewal(state, monkeypatch):
    actions = []
    monkeypatch.setattr(module, "release_conversion_schedule", lambda *_: actions.append("release"))
    state.remote.Subscription.modify.side_effect = lambda *_args, **_kwargs: actions.append("cancel")
    state.org.subscription_id = state.sub.id
    state.remote.Subscription.list.return_value.auto_paging_iter.side_effect = lambda: iter([state.sub])
    state.service.cancel()
    assert actions == ["release", "cancel"]
