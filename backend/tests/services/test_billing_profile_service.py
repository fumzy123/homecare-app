from types import SimpleNamespace as NS
from unittest.mock import MagicMock
import pytest
import stripe
from app.core.exceptions import AppError
from app.services import billing_profile_service as module


def obj(**values):
    return stripe.StripeObject.construct_from(values, None)


@pytest.fixture
def state(monkeypatch):
    remote = MagicMock()
    monkeypatch.setattr(module, "stripe", remote)
    service = module.BillingProfileService(MagicMock(), NS(email="owner@example.test"), "org")
    service.org_repo = MagicMock()
    service.agreement_repo = MagicMock()
    org = NS(id="org", stripe_customer_id="cus_own", subscription_id="sub_own")
    service.org_repo.lock_by_id.return_value = org
    service.agreement_repo.get_for_org.return_value = NS(payment_method_id="pm_old")
    remote.PaymentMethod.retrieve.return_value = obj(id="pm_new", customer="cus_own", type="card")
    remote.Customer.retrieve.return_value = obj(invoice_settings={"default_payment_method": "pm_old"})
    remote.Subscription.retrieve.return_value = obj(id="sub_own", customer="cus_own", status="active", default_payment_method="pm_old")
    return service, remote, org


def test_cannot_use_another_customers_card(state):
    service, remote, _ = state
    remote.PaymentMethod.retrieve.return_value.customer = "cus_other"
    with pytest.raises(AppError):
        service.card("pm_new")
    remote.Customer.modify.assert_not_called()
    remote.Subscription.modify.assert_not_called()


def test_default_updates_subscription_customer_and_activation_card(state):
    service, remote, _ = state
    service.card("pm_new")
    remote.Subscription.modify.assert_called_once_with("sub_own", default_payment_method="pm_new")
    remote.Customer.modify.assert_called_once_with("cus_own", invoice_settings={"default_payment_method": "pm_new"})
    assert service.agreement_repo.get_for_org.return_value.payment_method_id == "pm_new"


def test_cannot_remove_default_card(state):
    service, remote, _ = state
    with pytest.raises(AppError):
        service.card("pm_old", remove=True)
    remote.PaymentMethod.detach.assert_not_called()


def test_can_remove_nondefault_card(state):
    service, remote, _ = state
    service.card("pm_new", remove=True)
    remote.PaymentMethod.detach.assert_called_once_with("pm_new")


def test_card_setup_does_not_create_a_subscription(state):
    service, remote, org = state
    org.stripe_customer_id = None
    remote.Customer.create.return_value = obj(id="cus_new")
    remote.SetupIntent.create.return_value = obj(client_secret="test_secret")
    assert service.setup() == {"client_secret": "test_secret"}
    assert org.stripe_customer_id == "cus_new"
    remote.Subscription.create.assert_not_called()


def test_returned_setup_intent_must_belong_to_customer(state):
    service, remote, _ = state
    remote.SetupIntent.retrieve.return_value = obj(customer="cus_other", status="succeeded", payment_method="pm_new")
    with pytest.raises(AppError):
        service.confirm_setup("seti_other")
    remote.Customer.modify.assert_not_called()
