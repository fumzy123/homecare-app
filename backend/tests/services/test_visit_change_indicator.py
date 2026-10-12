"""Worker update labels describe visit edits, not lifecycle bookkeeping."""
from datetime import date, datetime
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.core.enums import ShiftCompletionStatus
from app.services.shift_service import ShiftService


def occurrence_response(overrides=None, *, instructions="Use side entrance"):
    shift = SimpleNamespace(
        id=uuid4(), start_time=datetime(2026, 9, 28, 23),
        end_time=datetime(2026, 9, 29, 6), notes=instructions,
        service_type=None, location=None, is_recurring=True,
        recurrence_rule="FREQ=WEEKLY;BYDAY=MO,WE,FR", recurrence_end_date=None,
        worker=SimpleNamespace(id=uuid4(), person=SimpleNamespace(
            first_name="Test", last_name="Worker", email="worker@example.com")),
        client=SimpleNamespace(id=uuid4(), first_name="Test", last_name="Client",
            date_of_birth=date(1950, 1, 1), street="1 Example St", city="Example",
            medical_conditions=None),
    )
    modification = None if overrides is None else SimpleNamespace(**{
        "id": uuid4(), "new_start_time": None, "new_end_time": None,
        "notes": None, "completion_status": ShiftCompletionStatus.scheduled,
        **overrides,
    })
    return ShiftService._build_occurrence_response(shift, date(2026, 9, 30), modification)


@pytest.mark.parametrize("status", list(ShiftCompletionStatus))
def test_lifecycle_status_alone_is_not_a_visit_update(status):
    result = occurrence_response({"completion_status": status})
    assert result.is_modification  # Admin edit routing must remain compatible.
    assert result.completion_status == status
    assert result.has_visit_changes is False


def test_unmodified_recurring_overnight_visit_is_not_an_update():
    result = occurrence_response()
    assert result.start_time == datetime(2026, 9, 30, 23)
    assert result.end_time == datetime(2026, 10, 1, 6)
    assert result.is_modification is False
    assert result.has_visit_changes is False


@pytest.mark.parametrize("overrides", [
    {"new_start_time": datetime(2026, 10, 1, 0)},
    {"new_end_time": datetime(2026, 10, 1, 7)},
    {"notes": "Use front entrance"},
    {"notes": ""},
    {"new_start_time": datetime(2026, 10, 2, 23)},
    {"new_end_time": datetime(2026, 10, 1, 7),
     "completion_status": ShiftCompletionStatus.completed},
])
def test_actual_visit_edits_are_reported_even_after_completion(overrides):
    result = occurrence_response(overrides)
    assert result.model_dump(mode="json")["has_visit_changes"] is True


def test_no_op_overrides_do_not_show_an_update():
    result = occurrence_response({
        "new_start_time": datetime(2026, 9, 30, 23),
        "new_end_time": datetime(2026, 10, 1, 6),
        "notes": "Use side entrance",
    })
    assert result.has_visit_changes is False


def test_empty_instructions_are_equivalent_to_no_instructions():
    assert occurrence_response({"notes": ""}, instructions=None).has_visit_changes is False
