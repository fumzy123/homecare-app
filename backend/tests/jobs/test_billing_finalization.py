from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

from app.jobs import billing_finalization as job


def test_rollout_gate_does_not_open_database(monkeypatch):
    session = MagicMock()
    monkeypatch.setattr(job, "SessionLocal", session)
    for onboarding, finalization in ((False, False), (True, False), (False, True)):
        monkeypatch.setattr(job, "settings", SimpleNamespace(
            billing_onboarding_enabled=onboarding, billing_usage_finalization_enabled=finalization))
        job.finalize_due_billing_periods()
    session.assert_not_called()


def test_each_period_has_own_session_and_one_failure_does_not_stop_batch(monkeypatch):
    monkeypatch.setattr(job, "settings", SimpleNamespace(
        billing_onboarding_enabled=True, billing_usage_finalization_enabled=True))
    contexts = [MagicMock() for _ in range(3)]
    sessions = [context.__enter__.return_value for context in contexts]
    monkeypatch.setattr(job, "SessionLocal", MagicMock(side_effect=contexts))
    due = [(uuid4(), uuid4()), (uuid4(), uuid4())]
    repo = MagicMock()
    repo.due_periods.return_value = due
    monkeypatch.setattr(job, "BillingFinalizationRepository", lambda db: repo)
    services = [MagicMock(), MagicMock()]
    services[0].finalize.side_effect = RuntimeError("retry later")
    factory = MagicMock(side_effect=services)
    monkeypatch.setattr(job, "BillingFinalizationService", factory)
    job.finalize_due_billing_periods()
    assert [call.args[0] for call in factory.call_args_list] == sessions[1:]
    for service, pair in zip(services, due):
        service.finalize.assert_called_once_with(*pair)
    for context in contexts:
        context.__exit__.assert_called_once()
