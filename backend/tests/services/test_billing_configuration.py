from types import SimpleNamespace
from unittest.mock import Mock
from app.services.billing_configuration import verify_billing_configuration


class StripeResponse(SimpleNamespace):
    def __getitem__(self, key):
        try:
            return getattr(self, key)
        except AttributeError as exc:
            raise KeyError(key) from exc


def fixture(monkeypatch, environment="staging"):
    monkeypatch.setenv("RAILWAY_ENVIRONMENT_NAME", environment)
    config = SimpleNamespace(app_env=environment, stripe_account_id="acct_homecare",
        stripe_secret_key="sk_test_private", stripe_webhook_secret="whsec_private",
        stripe_standard_monthly_price_id="price_month", stripe_standard_annual_price_id="price_year",
        stripe_founding_monthly_price_id="price_founder", stripe_standard_additional_client_price_id="price_usage_standard",
        stripe_founding_additional_client_price_id="price_usage_founding")
    client = Mock()
    client.v1.accounts.retrieve_current.return_value = SimpleNamespace(id="acct_homecare")
    client.v1.prices.retrieve.side_effect = [StripeResponse(id=p, active=True, livemode=False,
        currency="cad", unit_amount=a, recurring={"interval": i, "interval_count": 1}) for p, a, i in
        [("price_month", 35000, "month"), ("price_year", 336000, "year"), ("price_founder", 20000, "month")]] + [
        StripeResponse(id=p, active=True, livemode=False, currency="cad", unit_amount=a, type="one_time",
            tax_behavior="exclusive", product={"metadata": {"care_harbor_component": "additional_client_usage"}})
        for p, a in [("price_usage_standard", 1000), ("price_usage_founding", 500)]]
    return config, client


def test_matching_account_and_prices_without_exposing_secrets(monkeypatch):
    config, client = fixture(monkeypatch)
    result = verify_billing_configuration(config, client)
    assert result["errors"] == []
    assert len(result["checks"]) == 5
    assert "private" not in str(result)


def test_staging_rejects_live_key_before_network(monkeypatch):
    config, client = fixture(monkeypatch)
    config.stripe_secret_key = "sk_live_private"
    assert verify_billing_configuration(config, client)["errors"] == ["STRIPE_KEY_MODE_MISMATCH"]
    client.v1.accounts.retrieve_current.assert_not_called()


def test_wrong_business_account_stops_verification(monkeypatch):
    config, client = fixture(monkeypatch)
    client.v1.accounts.retrieve_current.return_value = SimpleNamespace(id="acct_other")
    assert verify_billing_configuration(config, client)["errors"] == ["STRIPE_ACCOUNT_MISMATCH"]
    client.v1.prices.retrieve.assert_not_called()


def test_wrong_price_is_not_verified(monkeypatch):
    config, client = fixture(monkeypatch)
    client.v1.prices.retrieve.side_effect = None
    client.v1.prices.retrieve.return_value = StripeResponse(id="price_wrong", active=True, livemode=True,
        currency="usd", unit_amount=35000, recurring={"interval": "month", "interval_count": 1})
    assert len(verify_billing_configuration(config, client)["errors"]) == 5
