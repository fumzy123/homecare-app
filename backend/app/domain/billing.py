"""Versioned commercial terms; no identity, persistence, or Stripe calls.

Persist the plan version with billing records. Never edit a published version's
rates: add a new version instead. Catalog membership does not grant eligibility
for founding pricing; that is a service-layer responsibility.
"""
from dataclasses import dataclass
from enum import Enum
from types import MappingProxyType


class PlanCode(str, Enum):
    standard = "standard"
    founding = "founding"


class BillingInterval(str, Enum):
    month = "month"
    year = "year"


@dataclass(frozen=True)
class PlanDefinition:
    code: PlanCode
    version: int
    base_interval: BillingInterval
    base_amount_cents: int
    additional_client_amount_cents: int
    included_clients: int = 10
    currency: str = "cad"
    usage_interval: BillingInterval = BillingInterval.month

    def additional_client_count(self, active_clients: int) -> int:
        if isinstance(active_clients, bool) or not isinstance(active_clients, int):
            raise ValueError("Active client count must be an integer")
        if active_clients < 0:
            raise ValueError("Active client count cannot be negative")
        return max(0, active_clients - self.included_clients)

    def usage_amount_cents(self, active_clients: int) -> int:
        """Monthly usage only; base charges depend on invoice timing."""
        return self.additional_client_count(active_clients) * self.additional_client_amount_cents


_PLAN_DEFINITIONS = (
    PlanDefinition(PlanCode.standard, 1, BillingInterval.month, 30_000, 500),
    PlanDefinition(PlanCode.standard, 1, BillingInterval.year, 300_000, 500),
    PlanDefinition(PlanCode.founding, 1, BillingInterval.month, 20_000, 400),
    PlanDefinition(PlanCode.standard, 2, BillingInterval.month, 35_000, 500),
    PlanDefinition(PlanCode.standard, 2, BillingInterval.year, 336_000, 500),
    PlanDefinition(PlanCode.standard, 3, BillingInterval.month, 35_000, 1_000),
    PlanDefinition(PlanCode.standard, 3, BillingInterval.year, 336_000, 1_000),
    PlanDefinition(PlanCode.founding, 2, BillingInterval.month, 20_000, 500),
)


def current_plan_version(code):
    return {PlanCode.founding: 2, PlanCode.standard: 3}[PlanCode(code)]

PLAN_CATALOG = MappingProxyType({
    (plan.code, plan.version, plan.base_interval): plan
    for plan in _PLAN_DEFINITIONS
})


def get_plan(
    code: PlanCode | str,
    interval: BillingInterval | str,
    *,
    version: int,
) -> PlanDefinition:
    """Resolve exact terms, with no fallback to a different price or interval."""
    if isinstance(version, bool) or not isinstance(version, int):
        raise ValueError("Plan version must be an integer")
    try:
        key = (PlanCode(code), version, BillingInterval(interval))
        return PLAN_CATALOG[key]
    except (ValueError, KeyError) as exc:
        raise ValueError("Unsupported plan, version, or billing interval") from exc
