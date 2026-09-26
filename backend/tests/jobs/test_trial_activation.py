from unittest.mock import MagicMock
from uuid import uuid4

from app.jobs import trial_activation


def test_disabled_backstop_does_not_open_database(monkeypatch):
    monkeypatch.setattr(trial_activation.settings, "billing_onboarding_enabled", False)
    factory = MagicMock()
    monkeypatch.setattr(trial_activation, "SessionLocal", factory)
    trial_activation.request_due_trials()
    factory.assert_not_called()


def test_one_failed_agency_does_not_block_others(monkeypatch):
    monkeypatch.setattr(trial_activation.settings, "billing_onboarding_enabled", True)
    ids = [uuid4(), uuid4()]
    repo = MagicMock()
    repo.return_value.due_org_ids.return_value = ids
    service = MagicMock()
    service.return_value.request_start.side_effect = [RuntimeError("failure"), {}]
    monkeypatch.setattr(trial_activation, "SessionLocal", MagicMock())
    monkeypatch.setattr(trial_activation, "TrialActivationRepository", repo)
    monkeypatch.setattr(trial_activation, "TrialActivationService", service)
    trial_activation.request_due_trials()
    assert [call.args[0] for call in service.return_value.request_start.call_args_list] == ids
