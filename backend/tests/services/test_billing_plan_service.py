from datetime import datetime, timedelta, timezone
from types import SimpleNamespace as NS
from unittest.mock import MagicMock
import pytest
import stripe
from app.core.config import settings
from app.core.exceptions import AppError
from app.services import billing_plan_service as module


def obj(**values):
    return stripe.StripeObject.construct_from(values, None)


@pytest.fixture
def state(monkeypatch):
    remote = MagicMock()
    monkeypatch.setattr(module, "stripe", remote)
    monkeypatch.setattr(settings, "stripe_standard_monthly_v3_price_id", "price_month")
    monkeypatch.setattr(settings, "stripe_standard_annual_v3_price_id", "price_year")
    service = module.BillingPlanService(MagicMock(), NS(id="owner"), "org")
    service.org_repo = MagicMock()
    service.agreement_repo = MagicMock()
    end = int((datetime.now(timezone.utc) + timedelta(days=10)).timestamp())
    org = NS(id="org", stripe_customer_id="cus_own", subscription_id="sub_own", trial_ends_at=None)
    agreement = NS(plan_code="standard", base_interval="month", stripe_price_id="price_month", canceled_at=None)
    sub = obj(id="sub_own", customer="cus_own", status="active", metadata={}, schedule=None,
              items={"data": [{"id": "si_own", "quantity": 1, "price": {"id": "price_month"}, "current_period_end": end}]})
    service.org_repo.lock_by_id.return_value = org
    service.agreement_repo.get_for_org.return_value = agreement
    remote.Subscription.retrieve.return_value = sub
    remote.Price.retrieve.return_value = obj(active=True, currency="cad", unit_amount=336000, recurring={"interval": "year", "interval_count": 1})
    schedule = obj(id="sched_own", metadata={}, phases=[{"start_date": end - 864000}])
    remote.SubscriptionSchedule.create.return_value = schedule
    return NS(service=service, remote=remote, sub=sub, agreement=agreement, end=end, schedule=schedule)


def test_paid_change_schedules_at_renewal_without_proration(state):
    quote = state.service.preview("year")
    assert quote["due_now_cents"] == 0
    assert quote["effective_at"] == state.end
    state.service.change(quote)
    params = state.remote.SubscriptionSchedule.modify.call_args.kwargs
    assert params["proration_behavior"] == "none"
    assert params["phases"][0]["end_date"] == state.end
    assert params["phases"][1]["items"] == [{"price": "price_year", "quantity": 1}]
    assert state.agreement.base_interval == "month"


def test_tampered_quote_cannot_change_subscription(state):
    quote = state.service.preview("year")
    quote["base_amount_cents"] = 1
    with pytest.raises(AppError):
        state.service.change(quote)
    state.remote.SubscriptionSchedule.create.assert_not_called()


def test_trial_change_keeps_trial_end(state):
    state.sub.status = "trialing"
    changed = obj(**{**state.sub.to_dict(), "metadata": {"careharbor_interval": "year"},
                    "items": {"data": [{"quantity": 1, "price": {"id": "price_year"}}]}})
    state.remote.Subscription.modify.return_value = changed
    quote = state.service.preview("year")
    state.service.change(quote)
    params = state.remote.Subscription.modify.call_args.kwargs
    assert "trial_end" not in params and "billing_cycle_anchor" not in params
    assert params["proration_behavior"] == "none"
    assert state.agreement.base_interval == "year"


def test_existing_founder_is_not_silently_moved_to_standard(state):
    state.agreement.plan_code = "founding"
    with pytest.raises(AppError):
        state.service.preview("year")
    state.remote.Subscription.modify.assert_not_called()


def test_customer_is_checked_before_any_mutation(state):
    state.sub.customer = "cus_other"
    with pytest.raises(AppError):
        state.service.preview("year")


def test_changed_period_invalidates_preview(state):
    quote = state.service.preview("year")
    state.sub["items"]["data"][0].current_period_end += 100
    with pytest.raises(AppError):
        state.service.change(quote)
    state.remote.SubscriptionSchedule.create.assert_not_called()


def test_new_preview_has_distinct_idempotency_key(state):
    assert state.service.preview("year")["token"] != state.service.preview("year")["token"]


def test_cancel_pending_does_not_cancel_subscription(state):
    state.sub.schedule = "sched_own"
    state.schedule.metadata = {"careharbor_subscription": state.sub.id}
    state.schedule.phases = [obj(start_date=state.end, metadata={"careharbor_interval": "year"})]
    state.remote.SubscriptionSchedule.retrieve.return_value = state.schedule
    state.service.cancel_pending()
    state.remote.SubscriptionSchedule.release.assert_called_once_with("sched_own", preserve_cancel_date=True)
    state.remote.Subscription.cancel.assert_not_called()


def test_quote_survives_http_validation_and_includes_usage_rate(state):
    from app.api.routes.billing import PlanQuotePayload
    quote = state.service.preview("year")
    assert quote["additional_client_amount_cents"] == 1000
    assert quote["included_clients"] == 10
    assert quote["plan_version"] == 3
    payload = PlanQuotePayload.model_validate(quote)
    state.service.change(payload.model_dump())
    state.remote.SubscriptionSchedule.modify.assert_called_once()
