import asyncio
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.core.config import settings
from app.core.exceptions import AppError
from app.core.security import require_billing_operator
from app.services.trial_activation_service import TrialActivationService

NOW = datetime(2026, 9, 26, tzinfo=timezone.utc)


@pytest.fixture
def service(monkeypatch):
    operator = SimpleNamespace(id=uuid4())
    monkeypatch.setattr(settings, "billing_onboarding_enabled", True)
    monkeypatch.setattr(settings, "billing_operator_user_ids", [str(operator.id)])
    service = TrialActivationService(MagicMock(), operator)
    service.trial_activation_repo = MagicMock()
    service.trial_activation_repo.get_for_org.return_value = None
    service.trial_activation_repo.lock_organization.return_value = SimpleNamespace(
        id=uuid4(), onboarding_deadline_at=NOW + timedelta(days=20),
        onboarding_completed_at=None, trial_starts_at=None, trial_ends_at=None,
        subscription_id=None,
    )
    return service


def test_operator_queues_request_without_claiming_stripe_activation(service):
    org = service.trial_activation_repo.lock_organization.return_value
    result = service.request_start(org.id, now=NOW)
    assert result["status"] == "pending"
    assert result["planned_trial_ends_at"] == NOW + timedelta(days=14)
    assert org.onboarding_completed_at == NOW
    assert org.trial_starts_at is None
    request = service.trial_activation_repo.add.call_args.args[0]
    assert request.requested_by == service.current_user.id
    service.db.commit.assert_called_once()


def test_repeated_request_reuses_original_window(service):
    org = service.trial_activation_repo.lock_organization.return_value
    first = service.request_start(org.id, now=NOW)
    service.trial_activation_repo.get_for_org.return_value = service.trial_activation_repo.add.call_args.args[0]
    second = service.request_start(org.id, now=NOW + timedelta(days=2))
    assert second == first
    service.trial_activation_repo.add.assert_called_once()
    assert org.onboarding_completed_at == NOW


def test_backstop_preserves_deadline_and_does_not_mark_onboarding_complete(service):
    service.current_user = None
    org = service.trial_activation_repo.lock_organization.return_value
    org.onboarding_deadline_at = NOW - timedelta(days=2)
    result = service.request_start(org.id, now=NOW)
    assert result["planned_trial_starts_at"] == org.onboarding_deadline_at
    assert org.onboarding_completed_at is None


def test_expired_window_requires_review(service):
    service.current_user = None
    org = service.trial_activation_repo.lock_organization.return_value
    org.onboarding_deadline_at = NOW - timedelta(days=15)
    assert service.request_start(org.id, now=NOW)["status"] == "needs_review"


@pytest.mark.parametrize("field,value,code", [
    ("onboarding_deadline_at", None, "NOT_ENROLLED"),
    ("subscription_id", "sub_existing", "ALREADY_STARTED"),
    ("trial_starts_at", NOW, "ALREADY_STARTED"),
])
def test_legacy_and_existing_subscriptions_not_restarted(service, field, value, code):
    org = service.trial_activation_repo.lock_organization.return_value
    setattr(org, field, value)
    with pytest.raises(AppError) as error:
        service.request_start(org.id, now=NOW)
    assert error.value.code == code
    service.trial_activation_repo.add.assert_not_called()
    service.db.rollback.assert_called_once()


def test_early_backstop_cannot_start_trial(service):
    service.current_user = None
    with pytest.raises(AppError) as error:
        service.request_start(uuid4(), now=NOW)
    assert error.value.code == "NOT_DUE"


def test_rollout_disabled_by_configuration(service, monkeypatch):
    monkeypatch.setattr(settings, "billing_onboarding_enabled", False)
    with pytest.raises(AppError) as error:
        service.request_start(uuid4(), now=NOW)
    assert error.value.code == "ONBOARDING_DISABLED"
    service.trial_activation_repo.lock_organization.assert_not_called()


def test_database_failure_is_not_acknowledged(service):
    service.db.commit.side_effect = RuntimeError("database unavailable")
    with pytest.raises(RuntimeError):
        service.request_start(uuid4(), now=NOW)
    service.db.rollback.assert_called_once()


def test_operator_guard_ignores_agency_owner_metadata(monkeypatch):
    monkeypatch.setattr(settings, "billing_operator_user_ids", [])
    user = SimpleNamespace(id=uuid4(), user_metadata={"role": "owner"})
    with pytest.raises(AppError) as error:
        asyncio.run(require_billing_operator(user))
    assert error.value.status_code == 403


def test_configured_operator_allowed(service):
    assert asyncio.run(require_billing_operator(service.current_user)) == service.current_user
