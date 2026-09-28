from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4
from app.jobs import billing_period_recovery as job


def test_disabled_recovery_does_not_open_session(monkeypatch):
    monkeypatch.setattr(job, "settings", SimpleNamespace(billing_onboarding_enabled=False))
    session = MagicMock()
    monkeypatch.setattr(job, "SessionLocal", session)
    job.recover_billing_periods()
    session.assert_not_called()


def test_cutoff_persists_before_stripe_and_failure_does_not_stop_other_orgs(monkeypatch):
    monkeypatch.setattr(job, "settings", SimpleNamespace(billing_onboarding_enabled=True))
    orgs = [uuid4(), uuid4()]
    contexts = [MagicMock() for _ in range(5)]
    monkeypatch.setattr(job, "SessionLocal", MagicMock(side_effect=contexts))
    repo = MagicMock()
    repo.organizations.return_value = orgs
    monkeypatch.setattr(job, "BillingCutoffRepository", lambda db: repo)
    cutoffs = [MagicMock(), MagicMock()]
    monkeypatch.setattr(job, "BillingCutoffService", MagicMock(side_effect=cutoffs))
    recoveries = [MagicMock(), MagicMock()]

    def fail_after_cutoff(org):
        cutoffs[0].capture_due.assert_called_once_with(org)
        raise RuntimeError("Stripe unavailable")

    recoveries[0].recover.side_effect = fail_after_cutoff
    monkeypatch.setattr(job, "BillingPeriodRecoveryService", MagicMock(side_effect=recoveries))
    job.recover_billing_periods()
    for index, org in enumerate(orgs):
        cutoffs[index].capture_due.assert_called_once_with(org)
        recoveries[index].recover.assert_called_once_with(org)
    for context in contexts:
        context.__exit__.assert_called_once()
