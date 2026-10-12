from datetime import datetime, date, timedelta
from types import SimpleNamespace as NS
from uuid import uuid4
import pytest
from app.core.enums import ShiftCompletionStatus, ShiftStatus
from app.domain.staffing import next_qualifying_visit, on_standby
from app.domain.care_coverage import end_previous_coverage
from app.core.exceptions import AppError

NOW = datetime(2026, 10, 1, 12)


def shift(start=NOW, **overrides):
    return NS(
        **(
            dict(
                id=uuid4(),
                start_time=start,
                end_time=start + timedelta(hours=2),
                is_recurring=False,
                recurrence_rule=None,
                recurrence_end_date=None,
                modifications=[],
                service_type=None,
                location=None,
                notes=None,
                status=ShiftStatus.active,
            )
            | overrides
        )
    )


def mod(day, status, **changes):
    return NS(
        **(
            dict(
                id=uuid4(),
                original_date=day,
                new_start_time=None,
                new_end_time=None,
                completion_status=status,
                notes=None,
                location=None,
            )
            | changes
        )
    )


@pytest.mark.parametrize(
    ("next_visit", "expected"),
    [
        (None, True),
        (NOW, False),
        (NOW + timedelta(days=14), False),
        (NOW + timedelta(days=14, seconds=1), True),
    ],
)
def test_standby_is_forward_only_with_inclusive_boundary(next_visit, expected):
    assert on_standby(True, next_visit, NOW) == expected
    assert not on_standby(False, next_visit, NOW)


def test_past_work_does_not_prevent_standby_but_ongoing_work_does():
    assert next_qualifying_visit(shift(NOW - timedelta(days=1)), NOW) is None
    assert next_qualifying_visit(
        shift(NOW - timedelta(hours=1)), NOW
    ) == NOW - timedelta(hours=1)


@pytest.mark.parametrize(
    "status",
    [
        ShiftCompletionStatus.cancelled,
        ShiftCompletionStatus.dropped,
        ShiftCompletionStatus.completed,
        ShiftCompletionStatus.no_show,
    ],
)
def test_non_qualifying_occurrences_do_not_count(status):
    s = shift(NOW + timedelta(days=1))
    s.modifications = [mod(s.start_time.date(), status)]
    assert next_qualifying_visit(s, NOW) is None


def test_cancelled_recurrence_advances_and_retains_distant_next_shift():
    s = shift(
        NOW + timedelta(days=1),
        is_recurring=True,
        recurrence_rule="FREQ=WEEKLY;BYDAY=FR",
    )
    s.modifications = [
        mod(s.start_time.date() + timedelta(days=days), ShiftCompletionStatus.cancelled)
        for days in [0, 7]
    ]
    next_visit = next_qualifying_visit(s, NOW)
    assert next_visit == NOW + timedelta(days=15)
    assert on_standby(True, next_visit, NOW)
    s.recurrence_end_date = NOW.date() + timedelta(days=10)
    assert next_qualifying_visit(s, NOW) is None


def test_moved_occurrence_counts_at_its_actual_time():
    s = shift(NOW - timedelta(days=1))
    s.modifications = [
        mod(
            s.start_time.date(),
            ShiftCompletionStatus.scheduled,
            new_start_time=NOW + timedelta(days=2),
        )
    ]
    assert next_qualifying_visit(s, NOW) == NOW + timedelta(days=2)


def test_cutoff_preserves_past_records_and_cancels_future_exceptions():
    past = mod(date(2026, 9, 30), ShiftCompletionStatus.completed)
    future = mod(date(2026, 10, 2), ShiftCompletionStatus.scheduled)
    s = shift(
        is_recurring=True, recurrence_rule="FREQ=DAILY", modifications=[past, future]
    )
    end_previous_coverage([s], date(2026, 10, 1))
    assert s.recurrence_end_date == date(2026, 9, 30)
    assert past.completion_status == ShiftCompletionStatus.completed
    assert future.completion_status == ShiftCompletionStatus.cancelled
    assert len(s.modifications) == 2


@pytest.mark.parametrize(
    "status", [ShiftCompletionStatus.in_progress, ShiftCompletionStatus.completed]
)
def test_recorded_visit_blocks_unsafe_cutoff(status):
    s = shift(modifications=[mod(NOW.date(), status)])
    with pytest.raises(AppError) as error:
        end_previous_coverage([s], NOW.date())
    assert error.value.code == "RECORDED_VISIT_AT_CUTOFF"
