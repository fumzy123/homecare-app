from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.core.exceptions import AppError
from app.domain.billing_access import billing_access
from app.domain.billing_consent import CONSENT_VERSION
from app.services.billing_service import BillingService
from tests.services.test_billing_onboarding_service import state as base_state


@pytest.fixture
def state(monkeypatch):
    return base_state.__wrapped__(monkeypatch)


@pytest.mark.parametrize('age', [6, 20])
def test_owner_enrollment_preserves_original_trial_without_operator(state, age):
    state.org.created_at = state.now - timedelta(days=age)
    state.org.onboarding_deadline_at = None
    state.service.trial_activation_repo.get_for_org.return_value = None
    state.service._prepare_purchase(state.org, state.now)
    request = state.service.trial_activation_repo.add.call_args.args[0]
    assert request.source == 'purchase'
    assert request.ends_at == state.org.created_at + timedelta(days=14)
    assert request.starts_at == state.org.created_at
    assert billing_access(state.org, state.now).can_write == (age < 14)


def test_subscription_purchase_ignores_old_onboarding_deadline(state):
    state.org.onboarding_completed_at = None
    state.service.trial_activation_repo.get_for_org.return_value = None
    state.service._prepare_purchase(state.org, state.now)
    request = state.service.trial_activation_repo.add.call_args.args[0]
    assert request.starts_at == state.org.created_at
    assert request.ends_at == request.starts_at + timedelta(days=14)
    state.org.subscription_status = 'trialing'
    access = billing_access(state.org, state.now)
    assert not access.is_onboarding and access.is_trial_active and access.can_write


def test_expired_purchase_has_no_trial_or_retroactive_charge(state):
    state.request.source = 'purchase'
    state.request.ends_at = state.now - timedelta(days=8)
    state.sub.trial_start = None
    state.sub.trial_end = None
    state.sub.start_date = int(state.now.timestamp())
    state.sub.status = 'incomplete'
    state.service.process_activation(now=state.now)
    args = state.remote.Subscription.create.call_args.kwargs
    assert 'trial_end' not in args and 'backdate_start_date' not in args
    assert args['payment_behavior'] == 'default_incomplete'
    assert state.org.trial_ends_at == state.now
    assert not billing_access(state.org, state.now).can_write
    state.service.process_activation(now=state.now)
    state.remote.Subscription.create.assert_called_once()


def test_unenrolled_expired_owner_can_open_checkout(state):
    state.org.created_at = state.now - timedelta(days=40)
    state.org.onboarding_deadline_at = None
    state.service.agreement_repo.get_for_org.return_value = None
    state.service.agreement_repo.add.side_effect = lambda agreement: setattr(state.service.agreement_repo.get_for_org, 'return_value', agreement)
    state.service.trial_activation_repo.get_for_org.return_value = None
    state.service.trial_activation_repo.add.side_effect = lambda request: setattr(state.service.trial_activation_repo.get_for_org, 'return_value', request)
    state.remote.Price.retrieve.return_value = SimpleNamespace(active=True, currency='cad', unit_amount=35000,
        recurring=SimpleNamespace(interval='month', interval_count=1))
    state.remote.checkout.Session.create.return_value = SimpleNamespace(id='cs_new', url='https://checkout.stripe.com/test')
    result = state.service.setup_card('month', CONSENT_VERSION)
    assert result['url'] == 'https://checkout.stripe.com/test'
    assert not billing_access(state.org, state.now).can_write
    assert state.service.trial_activation_repo.get_for_org.return_value.source == 'purchase'
    state.remote.Subscription.create.assert_not_called()
    state.service.process_activation(now=state.now)
    state.remote.Subscription.create.assert_not_called()  # Checkout card has not been completed.


def test_short_remaining_trial_preserved_to_the_second(state):
    state.request.source = 'purchase'
    state.request.ends_at = state.now + timedelta(hours=2)
    state.sub.trial_end = int(state.request.ends_at.timestamp())
    state.service.process_activation(now=state.now)
    assert state.remote.Subscription.create.call_args.kwargs['trial_end'] == int(state.request.ends_at.timestamp())


def test_existing_subscription_cannot_be_purchased_again(state):
    state.org.subscription_id = 'sub_existing'
    with pytest.raises(AppError) as error:
        state.service.setup_card('month', CONSENT_VERSION)
    assert error.value.code == 'ALREADY_SUBSCRIBED'
    state.remote.checkout.Session.create.assert_not_called()


def test_confirmation_returns_hosted_invoice_for_authentication(state):
    state.request.source = 'purchase'
    state.request.ends_at = state.now - timedelta(days=1)
    state.agreement.checkout_session_id = 'cs_own'
    state.remote.checkout.Session.retrieve.return_value = SimpleNamespace(status='complete', mode='setup', customer='cus_own', setup_intent='seti_own')
    state.remote.SetupIntent.retrieve.return_value = SimpleNamespace(status='succeeded', customer='cus_own', payment_method='pm_own')
    state.sub.trial_end = None
    state.sub.trial_start = None
    state.sub.start_date = int(state.now.timestamp())
    state.sub.status = 'incomplete'
    state.sub.latest_invoice = 'in_payment'
    state.sub.customer = 'cus_own'
    state.remote.Subscription.retrieve.return_value = state.sub
    state.remote.Invoice.retrieve.return_value = {'hosted_invoice_url': 'https://invoice.stripe.com/test'}
    assert state.service.confirm_card()['url'] == 'https://invoice.stripe.com/test'
    assert not billing_access(state.org, state.now).can_write
    state.sub.status = 'active'  # Payment completed; webhook has not arrived yet.
    assert state.service.confirm_card()['url'] is None
    assert billing_access(state.org, state.now).can_write


def test_expired_purchase_requires_current_consent(state):
    state.agreement.checkout_session_id = 'cs_own'
    state.agreement.consent_version = 'old-terms'
    with pytest.raises(AppError) as error:
        state.service.confirm_card()
    assert error.value.code == 'CONSENT_REQUIRED'
    state.remote.Subscription.create.assert_not_called()


def test_checkout_webhook_only_confirms_matching_saved_session(monkeypatch):
    import app.services.billing_service as module
    onboarding = MagicMock()
    onboarding.agreement_repo.get_for_org.return_value = SimpleNamespace(checkout_session_id='cs_owned', canceled_at=None)
    monkeypatch.setattr(module, 'BillingOnboardingService', lambda *a, **kw: onboarding)
    service = BillingService(MagicMock())
    service.org_repo = MagicMock()
    service.org_repo.get_by_stripe_customer_id.return_value = SimpleNamespace(id='agency')
    service.dispatch_webhook('checkout.session.completed', SimpleNamespace(id='cs_other', customer='cus_own', mode='setup'))
    onboarding.confirm_card.assert_not_called()
    service.dispatch_webhook('checkout.session.completed', SimpleNamespace(id='cs_owned', customer='cus_own', mode='setup'))
    onboarding.confirm_card.assert_called_once()


def test_purchase_retry_after_trial_end_does_not_silently_charge(state):
    state.request.source = 'purchase'
    state.request.stripe_attempted_at = state.now - timedelta(hours=2)
    state.request.ends_at = state.now - timedelta(hours=1)
    state.service.process_activation(now=state.now)
    assert state.request.status == 'needs_review'
    state.remote.Subscription.create.assert_not_called()


def test_payment_failure_does_not_grant_access(state):
    state.request.source = 'purchase'
    state.request.ends_at = state.now - timedelta(days=1)
    state.remote.Subscription.create.side_effect = RuntimeError('payment connection failed')
    with pytest.raises(RuntimeError):
        state.service.process_activation(now=state.now)
    assert state.org.subscription_id is None
    assert state.request.status == 'pending'
    state.service.db.rollback.assert_called()


def test_operator_cannot_change_trial_after_purchase(state):
    from app.services.trial_activation_service import TrialActivationService
    service = TrialActivationService(state.service.db, state.service.current_user)
    original_end = state.request.ends_at
    with pytest.raises(AppError) as error:
        service.request_start(state.org.id, now=state.now)
    assert error.value.code == 'AUTOMATIC_TRIAL'
    assert state.request.ends_at == original_end
    state.remote.Subscription.modify.assert_not_called()


def test_billing_purchase_routes_remain_owner_only_and_outside_operational_guard():
    from app.api.api import router
    from app.core.security import require_owner
    from app.api.billing_access import require_operational_access
    def calls(node):
        return {node.call} | set().union(*(calls(d) for d in node.dependencies))
    routes = [r for r in router.routes if r.path.endswith(('/onboarding/card-setup', '/onboarding/confirm-card'))]
    assert len(routes) == 2
    for route in routes:
        assert require_owner in calls(route.dependant)
        assert require_operational_access not in calls(route.dependant)


def test_in_app_billing_mutations_require_owner_even_when_access_expired():
    from app.api.api import router
    from app.core.security import require_owner
    from app.api.billing_access import require_operational_access
    def calls(node):
        return {node.call} | set().union(*(calls(d) for d in node.dependencies))
    suffixes = ('/profile', '/plan/preview', '/plan/change', '/plan/pending', '/onboarding/embedded-setup',
                '/onboarding/embedded-confirm', '/payment-methods/{payment_method_id}', '/payment-methods/confirm', '/setup-intent', '/set-default-card')
    routes = [r for r in router.routes if '/billing/' in r.path and r.path.endswith(suffixes)]
    assert len(routes) >= 10
    for route in routes:
        assert require_owner in calls(route.dependant)
        assert require_operational_access not in calls(route.dependant)
