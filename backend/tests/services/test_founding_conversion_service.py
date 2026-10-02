from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
import stripe

from app.core.config import settings
from app.domain.founding import conversion_boundary
from app.services import founding_conversion_service as module


def obj(**values):
    return stripe.StripeObject.construct_from(values, None)


@pytest.fixture
def state(monkeypatch):
    now = datetime(2027, 8, 17, tzinfo=timezone.utc)
    end = datetime(2027, 10, 1, tzinfo=timezone.utc)
    monkeypatch.setattr(settings, "billing_onboarding_enabled", True)
    monkeypatch.setattr(settings, "stripe_standard_monthly_v3_price_id", "price_standard")
    remote = MagicMock()
    monkeypatch.setattr(module, "stripe", remote)
    svc = module.FoundingConversionService(MagicMock())
    for name in ("trial_activation_repo", "agreement_repo", "founding_offer_repo", "conversion_repo", "notification_repo"):
        setattr(svc, name, MagicMock())
    org = SimpleNamespace(id=uuid4(), subscription_id="sub_own", stripe_customer_id="cus_own", onboarding_deadline_at=now)
    agreement = SimpleNamespace(plan_code="founding", stripe_price_id="price_founder", canceled_at=None)
    offer = SimpleNamespace(protection_ends_at=end, released_at=None, forfeited_at=None)
    sub = obj(id="sub_own", customer="cus_own", status="active", schedule=None, metadata={},
              billing_cycle_anchor=int(datetime(2026, 10, 1, tzinfo=timezone.utc).timestamp()),
              items={"data": [{"price": {"id": "price_founder"}, "quantity": 1}]})
    schedule = obj(id="sched_own", status="active", metadata={},
                   phases=[{"start_date": int(datetime(2027, 8, 1, tzinfo=timezone.utc).timestamp()),
                            "items": [{"price": "price_founder", "quantity": 1}]}])
    svc.trial_activation_repo.lock_organization.return_value = org
    svc.agreement_repo.get_for_org.return_value = agreement
    svc.founding_offer_repo.get_for_org.return_value = offer
    svc.conversion_repo.get_for_org.return_value = None
    svc.conversion_repo.add.side_effect = lambda c: setattr(svc.conversion_repo.get_for_org, "return_value", c)
    remote.Subscription.retrieve.return_value = sub
    remote.Price.retrieve.return_value = obj(active=True, currency="cad", unit_amount=35000,
                                              recurring={"interval": "month", "interval_count": 1})
    remote.SubscriptionSchedule.create.return_value = schedule
    remote.SubscriptionSchedule.retrieve.return_value = schedule
    return SimpleNamespace(svc=svc, remote=remote, org=org, agreement=agreement, offer=offer,
                           now=now, end=end, sub=sub, schedule=schedule)


def run(state, **kwargs):
    state.svc.process(state.org.id, now=kwargs.get("now", state.now))
    return state.svc.conversion_repo.get_for_org.return_value


def test_notice_and_schedule_preserve_twelve_months_and_snapshot_rates(state):
    conversion = run(state)
    assert conversion.effective_at == state.end
    assert conversion.notice_at == state.now
    assert conversion.status == "scheduled"
    assert conversion.base_amount_cents == 35000
    assert conversion.additional_client_amount_cents == 1000
    assert state.agreement.plan_code == "founding"
    state.svc.notification_repo.create.assert_called_once()
    args = state.remote.SubscriptionSchedule.modify.call_args.kwargs
    assert args["end_behavior"] == "release" and args["proration_behavior"] == "none"
    assert args["phases"][0]["items"][0]["price"] == "price_founder"
    assert args["phases"][1]["items"][0]["price"] == "price_standard"
    assert args["phases"][1]["start_date"] == int(state.end.timestamp())


def test_late_notice_defers_to_next_renewal(state):
    conversion = run(state, now=state.end - timedelta(days=20))
    assert conversion.effective_at == datetime(2027, 11, 1, tzinfo=timezone.utc)
    assert conversion.effective_at - conversion.notice_at >= timedelta(days=30)


def test_not_due_does_not_publish_or_change_stripe(state):
    run(state, now=state.now - timedelta(days=1))
    state.svc.notification_repo.create.assert_not_called()
    state.remote.SubscriptionSchedule.create.assert_not_called()


def test_retry_recovers_configured_schedule_without_duplicate_notice_or_edit(state):
    conversion = run(state)
    state.sub.schedule = state.schedule.id
    args = state.remote.SubscriptionSchedule.modify.call_args.kwargs
    state.schedule.phases = [obj(**phase) for phase in args["phases"]]
    state.remote.SubscriptionSchedule.modify.reset_mock()
    run(state)
    assert conversion.status == "scheduled"
    state.svc.notification_repo.create.assert_called_once()
    state.remote.SubscriptionSchedule.create.assert_called_once()
    state.remote.SubscriptionSchedule.modify.assert_not_called()


def test_remote_create_before_commit_failure_reuses_same_key(state):
    conversion = run(state)
    conversion.status = "pending"
    conversion.schedule_id = None
    state.sub.schedule = state.schedule.id
    state.remote.SubscriptionSchedule.create.reset_mock()
    run(state)
    assert conversion.schedule_id == state.schedule.id
    assert state.remote.SubscriptionSchedule.create.call_args.kwargs["idempotency_key"] == f"founding-schedule-{conversion.id}"


def test_unknown_schedule_after_idempotency_window_requires_review(state):
    conversion = run(state)
    conversion.status = "pending"
    conversion.schedule_id = None
    conversion.attempted_at = state.now - timedelta(days=2)
    state.sub.schedule = "sched_unknown"
    state.remote.SubscriptionSchedule.create.reset_mock()
    state.remote.SubscriptionSchedule.modify.reset_mock()
    run(state)
    assert conversion.status == "needs_review"
    state.remote.SubscriptionSchedule.create.assert_not_called()
    state.remote.SubscriptionSchedule.modify.assert_not_called()


def test_missing_schedule_is_not_recreated_after_it_was_confirmed(state):
    conversion = run(state)
    state.remote.SubscriptionSchedule.create.reset_mock()
    run(state)
    assert conversion.status == "needs_review"
    state.remote.SubscriptionSchedule.create.assert_not_called()


def test_elapsed_unconfigured_transition_is_not_backdated(state):
    conversion = run(state)
    conversion.status = "pending"
    state.remote.SubscriptionSchedule.modify.reset_mock()
    run(state, now=state.end + timedelta(days=1))
    assert conversion.status == "needs_review"
    state.remote.SubscriptionSchedule.modify.assert_not_called()


def test_stripe_failure_leaves_notice_for_retry(state):
    state.remote.SubscriptionSchedule.modify.side_effect = RuntimeError("network")
    with pytest.raises(RuntimeError):
        run(state)
    assert state.svc.conversion_repo.get_for_org.return_value.status == "pending"
    assert state.svc.db.rollback.called
    state.svc.notification_repo.create.assert_called_once()


def test_cancel_releases_schedule_without_repricing(state):
    conversion = run(state)
    state.sub.schedule = state.schedule.id
    state.agreement.canceled_at = state.now
    state.remote.SubscriptionSchedule.modify.reset_mock()
    run(state)
    assert conversion.status == "canceled"
    state.remote.SubscriptionSchedule.release.assert_called_once_with(state.schedule.id, preserve_cancel_date=True)
    state.remote.SubscriptionSchedule.modify.assert_not_called()


def test_conversion_confirmed_from_stripe_not_from_clock_alone(state):
    conversion = run(state)
    state.sub["items"]["data"][0]["price"]["id"] = conversion.target_price_id
    state.sub.metadata = obj(founding_conversion_id=str(conversion.id))
    run(state, now=state.end)
    assert conversion.status == "converted"
    assert conversion.converted_at == state.end


def test_early_remote_price_change_requires_review(state):
    conversion = run(state)
    state.sub["items"]["data"][0]["price"]["id"] = conversion.target_price_id
    state.sub.metadata = obj(founding_conversion_id=str(conversion.id))
    run(state)
    assert conversion.status == "needs_review"


def test_cancel_after_conversion_also_releases_remaining_standard_phase(state):
    conversion = run(state)
    conversion.status = "converted"
    state.sub.schedule = state.schedule.id
    module.release_conversion_schedule(conversion, state.sub)
    state.remote.SubscriptionSchedule.release.assert_called_once()
    assert conversion.status == "converted"


@pytest.mark.parametrize("change", ["wrong_price", "foreign_customer", "existing_schedule"])
def test_invalid_remote_state_never_announces_or_overwrites(state, change):
    if change == "wrong_price":
        state.remote.Price.retrieve.return_value.unit_amount = 999
    elif change == "foreign_customer":
        state.sub.customer = "cus_foreign"
    else:
        state.sub.schedule = "sched_foreign"
    with pytest.raises(Exception):
        run(state)
    state.svc.notification_repo.create.assert_not_called()
    state.remote.SubscriptionSchedule.modify.assert_not_called()


def test_rollout_disabled_skips_everything(state, monkeypatch):
    monkeypatch.setattr(settings, "billing_onboarding_enabled", False)
    run(state)
    state.svc.trial_activation_repo.lock_organization.assert_not_called()


def test_month_end_boundaries_use_original_anchor():
    anchor = datetime(2024, 1, 31, tzinfo=timezone.utc)
    protected = datetime(2025, 1, 31, tzinfo=timezone.utc)
    notice = datetime(2025, 2, 1, tzinfo=timezone.utc)
    assert conversion_boundary(anchor, protected, notice) == datetime(2025, 3, 31, tzinfo=timezone.utc)


def test_naive_boundary_is_rejected():
    with pytest.raises(ValueError):
        conversion_boundary(datetime(2024, 1, 1), datetime.now(timezone.utc), datetime.now(timezone.utc))
