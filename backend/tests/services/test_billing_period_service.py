from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4
import pytest
import stripe

from app.core.config import settings
from app.core.exceptions import AppError
from app.services import billing_usage_service as module


def utc(month, day, year=2026):
    return datetime(year, month, day, 12, tzinfo=timezone.utc)


@pytest.fixture
def state(monkeypatch):
    monkeypatch.setattr(settings, "billing_onboarding_enabled", True)
    svc = module.BillingUsageService(MagicMock(), None, uuid4())
    for name in ("usage_repo", "period_repo", "trial_activation_repo", "agreement_repo", "conversion_repo"):
        setattr(svc, name, MagicMock())
    org = SimpleNamespace(id=svc.org_id, billing_timezone="America/St_Johns", onboarding_deadline_at=utc(1, 1),
                          subscription_id="sub_own", stripe_customer_id="cus_own", trial_ends_at=utc(1, 31),
                          subscription_status="active", trial_starts_at=utc(1, 17), created_at=utc(1, 17))
    agreement = SimpleNamespace(plan_code="standard", plan_version=1, base_interval="month", stripe_price_id="price_standard")
    sub = stripe.StripeObject.construct_from({
        "id": "sub_own", "customer": "cus_own", "status": "active", "metadata": {},
        "items": {"data": [{"quantity": 1, "price": {"id": "price_standard"},
                            "current_period_start": int(utc(2, 28).timestamp()),
                            "current_period_end": int(utc(3, 31).timestamp())}]},
    }, None)
    remote = MagicMock()
    remote.Subscription.retrieve.return_value = sub
    monkeypatch.setattr(module, "stripe", remote)
    svc.trial_activation_repo.lock_organization.return_value = org
    svc.agreement_repo.get_for_org.return_value = agreement
    svc.conversion_repo.get_for_org.return_value = None
    svc.period_repo.get.return_value = None
    svc.period_repo.add.side_effect = lambda p: setattr(svc.period_repo.get, "return_value", p)
    svc.estimate = MagicMock(return_value={"active_client_count": 30, "is_estimate": True, "clients": []})
    return SimpleNamespace(svc=svc, org=org, agreement=agreement, sub=sub, remote=remote, now=utc(3, 1))


def test_monthly_current_uses_stripe_and_freezes_rates_without_charging(state):
    result = state.svc.current(now=state.now)
    period = result["period"]
    assert period["starts_at"] == utc(2, 28) and period["ends_at"] == utc(3, 31)
    assert period["agency_timezone"] == "America/St_Johns"
    assert period["finalization_eligible_at"] == utc(3, 31) + timedelta(hours=72)
    assert result["usage"]["additional_clients"] == 20
    assert result["usage"]["estimated_usage_amount_cents"] == 10000
    state.svc.period_repo.get.assert_called_with(state.org.id, "sub_own", utc(2, 28))
    state.remote.Subscription.modify.assert_not_called()
    state.remote.Invoice.create.assert_not_called()


def test_usage_breakdown_enriches_labels_in_one_scoped_lookup(state):
    client_id, missing_id = uuid4(), uuid4()
    state.svc.estimate.return_value = {"active_client_count": 2, "clients": [{"client_id": client_id}, {"client_id": missing_id}]}
    state.svc.usage_repo.client_labels.return_value = {client_id: {"client_name": "Test Client", "client_archived": True}}
    result = state.svc.current(now=state.now)
    state.svc.usage_repo.client_labels.assert_called_once_with(state.org.id, [client_id, missing_id])
    assert result["usage"]["clients"][0]["client_archived"] is True
    assert result["usage"]["clients"][1]["client_name"] is None
    assert result["usage"]["calculated_at"].tzinfo is not None


def test_retry_reuses_same_period_and_preserves_stored_unit_rate(state):
    first = state.svc.current(now=state.now)
    state.svc.period_repo.get.return_value.additional_client_amount_cents = 450
    again = state.svc.current(now=state.now)
    assert again["period"]["id"] == first["period"]["id"]
    assert again["usage"]["estimated_usage_amount_cents"] == 9000
    state.svc.period_repo.add.assert_called_once()


def test_annual_base_still_has_monthly_allowance(state):
    state.agreement.base_interval = "year"
    state.sub["items"]["data"][0]["current_period_start"] = int(utc(1, 31).timestamp())
    state.sub["items"]["data"][0]["current_period_end"] = int(utc(1, 31, 2027).timestamp())
    result = state.svc.current(now=state.now)
    assert result["period"]["base_interval"] == "year"
    assert result["period"]["starts_at"] == utc(2, 28)
    assert result["period"]["ends_at"] == utc(3, 31)
    assert result["usage"]["estimated_usage_amount_cents"] == 10000  # No annual base included.


def test_trial_visits_never_create_paid_period(state):
    state.org.subscription_status = "trialing"
    result = state.svc.current(now=utc(1, 20))
    assert result["state"] == "ready" and result["trial_preview"]
    assert result["usage"]["active_client_count"] == 30
    assert result["usage"]["estimated_usage_amount_cents"] == 0
    state.remote.Subscription.retrieve.assert_not_called()
    state.svc.period_repo.add.assert_not_called()


@pytest.mark.parametrize("condition", ["customer", "price", "period", "quantity", "timezone"])
def test_unconfirmed_terms_fail_closed(state, condition):
    if condition == "customer":
        state.sub.customer = "cus_other"
    elif condition == "price":
        state.sub["items"]["data"][0]["price"]["id"] = "price_unknown"
    elif condition == "period":
        state.sub["items"]["data"][0]["current_period_end"] += 3600
    elif condition == "quantity":
        state.sub["items"]["data"][0]["quantity"] = 2
    else:
        state.org.billing_timezone = None
    with pytest.raises(AppError) as error:
        state.svc.current(now=state.now)
    assert error.value.code == "BILLING_PERIOD_REVIEW_REQUIRED"
    state.svc.period_repo.add.assert_not_called()
    state.svc.estimate.assert_not_called()


def test_canceled_subscription_does_not_create_new_period(state):
    state.sub.status = "canceled"
    assert state.svc.current(now=state.now)["state"] == "no_current_period"
    state.svc.period_repo.add.assert_not_called()


def test_founder_rates_and_conversion_use_period_not_current_consent(state):
    state.agreement.plan_code = "founding"
    state.agreement.stripe_price_id = "price_founder"
    state.sub["items"]["data"][0]["price"]["id"] = "price_founder"
    assert state.svc.current(now=state.now)["usage"]["estimated_usage_amount_cents"] == 8000
    state.svc.period_repo.get.return_value = None
    conversion = SimpleNamespace(id=uuid4(), org_id=state.org.id, subscription_id="sub_own", status="scheduled",
                                 effective_at=utc(2, 28), target_plan_version=1, target_price_id="price_standard")
    state.svc.conversion_repo.get_for_org.return_value = conversion
    state.sub["items"]["data"][0]["price"]["id"] = "price_standard"
    state.sub.metadata["founding_conversion_id"] = str(conversion.id)
    assert state.svc.current(now=state.now)["usage"]["estimated_usage_amount_cents"] == 10000


def test_timezone_initial_choice_idempotent_then_locked(state):
    state.org.billing_timezone = None
    assert state.svc.set_timezone("America/St_Johns")["billing_timezone"] == "America/St_Johns"
    state.svc.set_timezone("America/St_Johns")
    with pytest.raises(AppError) as error:
        state.svc.set_timezone("America/Toronto")
    assert error.value.code == "TIMEZONE_LOCKED"


def test_invalid_timezone_rolls_back_without_changing_setting(state):
    with pytest.raises(AppError):
        state.svc.set_timezone("unknown")
    assert state.org.billing_timezone == "America/St_Johns"
    state.svc.db.rollback.assert_called_once()


def test_disabled_rollout_does_not_contact_stripe(state, monkeypatch):
    monkeypatch.setattr(settings, "billing_onboarding_enabled", False)
    with pytest.raises(AppError):
        state.svc.current(now=state.now)
    state.remote.Subscription.retrieve.assert_not_called()
