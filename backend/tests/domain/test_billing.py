"""Commercial acceptance examples for the immutable billing catalog."""
from dataclasses import FrozenInstanceError

import pytest

from app.domain.billing import BillingInterval, PLAN_CATALOG, get_plan


@pytest.mark.parametrize("clients,total", [(0, 30000), (10, 30000), (11, 30500), (30, 40000), (50, 50000), (100, 75000)])
def test_standard_monthly_examples(clients, total):
    plan = get_plan("standard", "month", version=1)
    assert plan.base_amount_cents + plan.usage_amount_cents(clients) == total


@pytest.mark.parametrize("clients,total", [(10, 20000), (30, 28000), (50, 36000), (100, 56000)])
def test_founding_monthly_examples(clients, total):
    plan = get_plan("founding", "month", version=1)
    assert plan.base_amount_cents + plan.usage_amount_cents(clients) == total


def test_annual_discount_only_applies_to_base():
    annual = get_plan("standard", "year", version=1)
    monthly = get_plan("standard", "month", version=1)
    assert annual.base_amount_cents == 300000
    assert monthly.base_amount_cents * 12 - annual.base_amount_cents == 60000
    assert annual.usage_interval == BillingInterval.month
    assert annual.usage_amount_cents(30) == monthly.usage_amount_cents(30) == 10000
    assert annual.usage_amount_cents(10) == 0


@pytest.mark.parametrize("code,interval,version", [
    ("founding", "year", 1),
    ("standard", "month", 3),
    ("unknown", "month", 1),
    ("standard", "week", 1),
    ("standard", "month", True),
    ("standard", "month", 1.0),
])
def test_unsupported_terms_cannot_fall_back_to_another_price(code, interval, version):
    with pytest.raises(ValueError):
        get_plan(code, interval, version=version)


@pytest.mark.parametrize("clients", [-1, 1.5, True, "30", None])
def test_invalid_counts_rejected(clients):
    with pytest.raises(ValueError):
        get_plan("standard", "month", version=1).usage_amount_cents(clients)


def test_published_catalog_cannot_be_mutated():
    plan = get_plan("standard", "month", version=1)
    assert all(p.currency == "cad" and p.included_clients == 10 for p in PLAN_CATALOG.values())
    with pytest.raises(FrozenInstanceError):
        plan.base_amount_cents = 1
    with pytest.raises(TypeError):
        PLAN_CATALOG[(plan.code, plan.version, plan.base_interval)] = plan
