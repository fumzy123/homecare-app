"""Checkout/reconciliation must use only explicitly configured current prices."""
import pytest

from app.core.config import Settings, settings
from app.services.billing_prices import price_id, standard_prices


@pytest.mark.parametrize("code,interval,version,field", [
    ("standard", "month", 3, "stripe_standard_monthly_price_id"),
    ("standard", "year", 3, "stripe_standard_annual_price_id"),
    ("founding", "month", 2, "stripe_founding_monthly_price_id"),
])
def test_current_price_requires_its_own_configuration(monkeypatch, code, interval, version, field):
    monkeypatch.setattr(settings, field, "price_current")
    assert price_id(code, interval, version) == "price_current"
    monkeypatch.setattr(settings, field, "")
    assert price_id(code, interval, version) == ""


@pytest.mark.parametrize("code,interval,version", [
    ("standard", "month", 1), ("standard", "year", 1),
    ("standard", "month", 2), ("standard", "year", 2),
    ("founding", "month", 1), ("founding", "year", 2),
    ("standard", "month", True), ("standard", "month", 3.0),
])
def test_retired_or_invalid_prices_cannot_fall_back(code, interval, version):
    with pytest.raises(ValueError):
        price_id(code, interval, version)


def test_legacy_environment_does_not_supply_missing_current_prices(monkeypatch):
    retired = (
        "stripe_price_id", "stripe_standard_monthly_v1_price_id",
        "stripe_standard_annual_v1_price_id", "stripe_standard_monthly_v2_price_id",
        "stripe_standard_annual_v2_price_id", "stripe_founding_monthly_v1_price_id",
        "stripe_standard_monthly_v3_price_id", "stripe_standard_annual_v3_price_id",
        "stripe_founding_monthly_v2_price_id",
    )
    for name in retired:
        monkeypatch.setenv(name.upper(), "price_retired")
        assert name not in Settings.model_fields
    config = Settings(_env_file=None, supabase_url="https://example.test",
                      supabase_secret_key="test", database_url="sqlite://",
                      stripe_standard_monthly_price_id="",
                      stripe_standard_annual_price_id="",
                      stripe_founding_monthly_price_id="")
    assert config.stripe_standard_monthly_price_id == ""
    assert config.stripe_standard_annual_price_id == ""
    assert config.stripe_founding_monthly_price_id == ""


def test_unversioned_environment_loads_current_prices(monkeypatch):
    values = {
        "stripe_standard_monthly_price_id": "price_month",
        "stripe_standard_annual_price_id": "price_year",
        "stripe_founding_monthly_price_id": "price_founding",
    }
    for name, value in values.items():
        monkeypatch.setenv(name.upper(), value)
    config = Settings(_env_file=None, supabase_url="https://example.test",
                      supabase_secret_key="test", database_url="sqlite://")
    for name, value in values.items():
        assert getattr(config, name) == value


def test_reconciliation_maps_only_configured_current_standard_prices(monkeypatch):
    monkeypatch.setattr(settings, "stripe_standard_monthly_price_id", "price_month")
    monkeypatch.setattr(settings, "stripe_standard_annual_price_id", "price_year")
    assert standard_prices() == {"price_month": ("month", 3), "price_year": ("year", 3)}
    monkeypatch.setattr(settings, "stripe_standard_annual_price_id", "")
    assert standard_prices() == {"price_month": ("month", 3)}
