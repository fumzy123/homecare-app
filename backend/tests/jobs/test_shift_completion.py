"""Tests for the scheduled shift-completion job."""
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

from app.core.enums import ShiftCompletionStatus
from app.jobs import shift_completion


class _FakeQuery:
    def __init__(self, shifts):
        self.shifts = shifts

    def filter(self, *args):
        return self

    def all(self):
        return self.shifts


class _FakeSession:
    def __init__(self, shifts):
        self.shifts = shifts
        self.added = []
        self.committed = False
        self.rolled_back = False
        self.closed = False

    def query(self, model):
        return _FakeQuery(self.shifts)

    def add(self, value):
        self.added.append(value)

    def commit(self):
        self.committed = True

    def rollback(self):
        self.rolled_back = True

    def close(self):
        self.closed = True


def test_marks_past_occurrence_completed_using_domain_expansion(monkeypatch):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    occurrence_date = now.date()
    shift = SimpleNamespace(
        id=uuid4(),
        start_time=now - timedelta(hours=2),
        end_time=now - timedelta(hours=1),
        modifications=[],
    )
    db = _FakeSession([shift])
    expansion_calls = []

    def fake_expand_occurrences(candidate, from_date, to_date):
        expansion_calls.append((candidate, from_date, to_date))
        return [occurrence_date]

    monkeypatch.setattr(shift_completion, "SessionLocal", lambda: db)
    monkeypatch.setattr(shift_completion, "expand_occurrences", fake_expand_occurrences)

    shift_completion.mark_shifts_completed()

    assert len(expansion_calls) == 1
    assert expansion_calls[0][0] is shift
    assert len(db.added) == 1
    assert db.added[0].shift_id == shift.id
    assert db.added[0].original_date == occurrence_date
    assert db.added[0].completion_status == ShiftCompletionStatus.completed
    assert db.committed is True
    assert db.rolled_back is False
    assert db.closed is True
