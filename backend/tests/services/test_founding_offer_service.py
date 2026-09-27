from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.core.config import settings
from app.core.exceptions import AppError
from app.domain.founding import protection_end, notice_due_at
from app.services.founding_offer_service import FoundingOfferService


@pytest.fixture
def service(monkeypatch):
    operator = SimpleNamespace(id=uuid4())
    monkeypatch.setattr(settings, "billing_operator_user_ids", [str(operator.id)])
    service = FoundingOfferService(MagicMock(), operator)
    service.founding_offer_repo = MagicMock()
    service.trial_activation_repo = MagicMock()
    service.agreement_repo = MagicMock()
    service.agreement_repo.get_for_org.return_value = None
    service.founding_offer_repo.get_for_org.return_value = None
    service.founding_offer_repo.lock_slots.return_value = [
        SimpleNamespace(slot_number=n, org_id=None, consumed_at=None) for n in (1, 2, 3)
    ]
    service.trial_activation_repo.lock_organization.return_value = SimpleNamespace(
        id=uuid4(), onboarding_deadline_at=datetime.now(timezone.utc), subscription_id=None,
    )
    return service


def test_first_three_allocations_succeed_fourth_fails(service):
    for n in (1, 2, 3):
        org_id = uuid4()
        service.trial_activation_repo.lock_organization.return_value.id = org_id
        assert service.reserve(org_id)["slot_number"] == n
    with pytest.raises(AppError) as error:
        service.reserve(uuid4())
    assert error.value.code == "FOUNDING_FULL"
    assert service.founding_offer_repo.add.call_count == 3


def test_duplicate_request_preserves_slot(service):
    org_id = service.trial_activation_repo.lock_organization.return_value.id
    first = service.reserve(org_id)
    service.founding_offer_repo.get_for_org.return_value = service.founding_offer_repo.add.call_args.args[0]
    assert service.reserve(org_id) == first
    service.founding_offer_repo.add.assert_called_once()


def test_release_unused_reservation_keeps_history_and_reopens_slot(service):
    org_id = service.trial_activation_repo.lock_organization.return_value.id
    service.reserve(org_id)
    offer = service.founding_offer_repo.add.call_args.args[0]
    service.founding_offer_repo.get_for_org.return_value = offer
    service.release(org_id)
    assert service.founding_offer_repo.lock_slots.return_value[0].org_id is None
    assert offer.released_at is not None
    with pytest.raises(AppError) as error:
        service.reserve(org_id)
    assert error.value.code == "FOUNDING_NOT_REUSABLE"


def test_paid_offer_permanently_consumes_slot_and_dates_do_not_restart(service):
    org_id = service.trial_activation_repo.lock_organization.return_value.id
    service.reserve(org_id)
    offer = service.founding_offer_repo.add.call_args.args[0]
    service.founding_offer_repo.get_for_org.return_value = offer
    service.agreement_repo.get_for_org.return_value = SimpleNamespace(plan_code="founding")
    start = datetime(2028, 2, 29, 12, tzinfo=timezone.utc)
    service.record_paid_period(org_id, start)
    assert offer.protection_ends_at == datetime(2029, 2, 28, 12, tzinfo=timezone.utc)
    service.record_paid_period(org_id, datetime(2028, 3, 29, tzinfo=timezone.utc))
    assert offer.protection_starts_at == start
    assert service.founding_offer_repo.lock_slots.return_value[0].consumed_at is not None
    with pytest.raises(AppError) as error:
        service.release(org_id)
    assert error.value.code == "FOUNDING_RELEASE_BLOCKED"


def test_operator_cannot_change_already_authorized_plan(service):
    service.agreement_repo.get_for_org.return_value = SimpleNamespace(plan_code="standard")
    with pytest.raises(AppError) as error:
        service.reserve(uuid4())
    assert error.value.code == "FOUNDING_TOO_LATE"


def test_cancellation_prevents_reallocation(service):
    service.reserve(uuid4())
    offer = service.founding_offer_repo.add.call_args.args[0]
    offer.forfeited_at = datetime.now(timezone.utc)
    service.founding_offer_repo.get_for_org.return_value = offer
    with pytest.raises(AppError) as error:
        service.reserve(uuid4())
    assert error.value.code == "FOUNDING_NOT_REUSABLE"


def test_ordinary_owner_cannot_allocate(service):
    service.current_user = SimpleNamespace(id=uuid4(), user_metadata={"role": "owner"})
    with pytest.raises(AppError) as error:
        service.reserve(uuid4())
    assert error.value.status_code == 403
    service.founding_offer_repo.lock_slots.assert_not_called()


def test_missing_seed_slots_fails_closed(service):
    service.founding_offer_repo.lock_slots.return_value = []
    with pytest.raises(AppError) as error:
        service.reserve(uuid4())
    assert error.value.code == "FOUNDING_NOT_CONFIGURED"


def test_protection_is_calendar_year_and_notice_thirty_days():
    start = datetime(2026, 9, 27, tzinfo=timezone.utc)
    end = protection_end(start)
    assert end == datetime(2027, 9, 27, tzinfo=timezone.utc)
    assert (end - notice_due_at(end)).days == 30
    with pytest.raises(ValueError):
        protection_end(start.replace(tzinfo=None))
