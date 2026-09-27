"""Completion uses the service transaction and always closes its own session."""
from unittest.mock import MagicMock
import pytest
from app.jobs import shift_completion


def test_job_closes_session_on_success_and_failure(monkeypatch):
    db = MagicMock()
    service = MagicMock()
    monkeypatch.setattr(shift_completion, "SessionLocal", lambda: db)
    monkeypatch.setattr(shift_completion, "ShiftCompletionService", lambda session: service)
    shift_completion.mark_shifts_completed()
    service.complete.assert_called_once()
    db.close.assert_called_once()
    service.complete.side_effect = RuntimeError("failed")
    with pytest.raises(RuntimeError):
        shift_completion.mark_shifts_completed()
    assert db.close.call_count == 2
