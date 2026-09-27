from datetime import date, datetime, timedelta, timezone
from uuid import uuid4

import pytest

from app.core.enums import ShiftCompletionStatus as Status, ShiftStatus
from app.domain.billing_usage import UsageCandidate, UsageWindow, active_clients
from app.models.shift import Shift
from app.models.shift_modification import ShiftModification


def shift(start=datetime(2026, 9, 10, 9), *, client_id=None, **kwargs):
    return Shift(id=uuid4(), org_id=uuid4(), client_id=client_id or uuid4(), start_time=start,
                 end_time=start + timedelta(hours=2), is_recurring=False, status=ShiftStatus.active,
                 **kwargs)


def mod(day=date(2026, 9, 10), *, status=Status.scheduled, new_start=None):
    return ShiftModification(id=uuid4(), original_date=day, completion_status=status, new_start_time=new_start)


@pytest.fixture
def window():
    return UsageWindow(datetime(2026, 9, 1, tzinfo=timezone.utc), datetime(2026, 10, 1, tzinfo=timezone.utc), "UTC")


def count(window, *candidates):
    return active_clients(candidates, window)


def test_many_shifts_and_workers_count_one_stable_client_id(window):
    client = uuid4()
    candidates = [UsageCandidate(shift(client_id=client), ()) for _ in range(20)]
    result = count(window, *candidates)
    assert len(result) == 1 and result[0].client_id == client


def test_remaining_client_shifts_are_not_evaluated(window):
    client = uuid4()
    first = shift(client_id=client)
    broken = shift(client_id=client)
    broken.is_recurring = True
    broken.recurrence_rule = "not a valid rule"
    assert len(count(window, UsageCandidate(first, ()), UsageCandidate(broken, ()))) == 1


@pytest.mark.parametrize("status,expected", [(s, int(s in (Status.scheduled, Status.in_progress, Status.completed, Status.no_show))) for s in Status])
def test_effective_status_controls_count(window, status, expected):
    assert len(count(window, UsageCandidate(shift(), (mod(status=status),)))) == expected


def test_canceling_last_visit_removes_client_on_recalculation(window):
    candidate = UsageCandidate(shift(), (mod(),))
    assert len(count(window, candidate)) == 1
    candidate.modifications[0].completion_status = Status.cancelled
    assert count(window, candidate) == ()


def test_canceled_visit_and_replacement_still_count_once(window):
    original = shift()
    replacement = shift(client_id=original.client_id)
    assert len(count(window, UsageCandidate(original, (mod(status=Status.dropped),)), UsageCandidate(replacement, ()))) == 1


def test_recurring_series_started_years_ago_counts(window):
    series = shift(datetime(2020, 1, 1, 9))
    series.is_recurring = True
    series.recurrence_rule = "FREQ=WEEKLY;BYDAY=MO,WE,FR"
    assert len(count(window, UsageCandidate(series, ()))) == 1


def test_series_all_canceled_and_expired_series_do_not_count(window):
    series = shift(datetime(2026, 9, 1, 9))
    series.is_recurring = True
    series.recurrence_rule = "FREQ=DAILY"
    series.recurrence_end_date = date(2026, 9, 3)
    cancellations = tuple(mod(date(2026, 9, day), status=Status.cancelled) for day in range(1, 4))
    assert count(window, UsageCandidate(series, cancellations)) == ()
    series.recurrence_end_date = date(2026, 8, 31)
    assert count(window, UsageCandidate(series, ())) == ()


def test_moved_in_from_future_master_and_moved_out(window):
    future = shift(datetime(2026, 11, 10, 9))
    moved = mod(date(2026, 11, 10), new_start=datetime(2026, 9, 15, 9))
    result = count(window, UsageCandidate(future, (moved,)))
    assert len(result) == 1 and result[0].occurrence_date == date(2026, 11, 10)
    assert result[0].local_start == datetime(2026, 9, 15, 9)
    assert count(window, UsageCandidate(shift(), (mod(new_start=datetime(2026, 10, 1)),))) == ()


def test_recurring_moved_in_from_original_date_outside_period(window):
    series = shift(datetime(2026, 7, 1, 9))
    series.is_recurring = True
    series.recurrence_rule = "FREQ=DAILY"
    series.recurrence_end_date = date(2026, 7, 2)
    assert len(count(window, UsageCandidate(series, (mod(date(2026, 7, 2), new_start=datetime(2026, 9, 2)),)))) == 1


def test_orphan_modification_cannot_invent_an_occurrence(window):
    candidate = UsageCandidate(shift(datetime(2026, 8, 1, 9)), (mod(new_start=datetime(2026, 9, 2)),))
    assert count(window, candidate) == ()


def test_completed_moved_visit_survives_truncated_original_date(window):
    from app.domain.scheduling import shift_has_occurrence_on
    series = shift(datetime(2026, 8, 1, 9))
    series.is_recurring = True
    series.recurrence_rule = "FREQ=DAILY"
    series.recurrence_end_date = date(2026, 9, 5)
    moved = mod(date(2026, 9, 10), status=Status.completed, new_start=datetime(2026, 9, 2))
    assert not shift_has_occurrence_on(series, moved.original_date)
    result = count(window, UsageCandidate(series, (moved,)))
    # Remove the normal earlier occurrences so this must use the preserved one.
    series.status = ShiftStatus.cancelled
    assert len(result) == 1
    assert len(count(window, UsageCandidate(series, (moved,)))) == 1


@pytest.mark.parametrize("status", [Status.completed, Status.no_show])
def test_terminal_evidence_survives_master_cancellation_and_deletion(window, status):
    master = shift()
    master.status = ShiftStatus.cancelled
    master.deleted_at = datetime(2026, 9, 20, tzinfo=timezone.utc)
    assert len(count(window, UsageCandidate(master, (mod(status=status),)))) == 1
    assert count(window, UsageCandidate(master, ())) == ()


def test_client_registry_and_worker_relationships_are_never_loaded(window):
    master = shift()
    # No registry or worker objects are attached; only stable client identity matters.
    assert len(count(window, UsageCandidate(master, ()))) == 1


def test_half_open_boundaries_and_overnight_start_rule(window):
    assert len(count(window, UsageCandidate(shift(datetime(2026, 9, 1)), ()))) == 1
    assert count(window, UsageCandidate(shift(datetime(2026, 10, 1)), ())) == ()
    assert count(window, UsageCandidate(shift(datetime(2026, 8, 31, 23)), ())) == ()
    assert len(count(window, UsageCandidate(shift(datetime(2026, 9, 30, 23)), ()))) == 1


def test_paid_window_excludes_trial_visit_that_ends_after_conversion():
    window = UsageWindow(datetime(2026, 9, 10, 10, tzinfo=timezone.utc), datetime(2026, 10, 10, 10, tzinfo=timezone.utc), "UTC")
    assert count(window, UsageCandidate(shift(), ())) == ()


def test_newfoundland_half_hour_offset():
    window = UsageWindow(datetime(2026, 9, 10, 12, tzinfo=timezone.utc), datetime(2026, 10, 10, 12, tzinfo=timezone.utc), "America/St_Johns")
    assert not window.contains_local_start(datetime(2026, 9, 10, 9, 29))
    assert window.contains_local_start(datetime(2026, 9, 10, 9, 30))


def test_dst_fold_inside_window_counts_without_guessing_fold():
    window = UsageWindow(datetime(2026, 11, 1, tzinfo=timezone.utc), datetime(2026, 12, 1, tzinfo=timezone.utc), "America/Toronto")
    assert window.contains_local_start(datetime(2026, 11, 1, 1, 30))


def test_dst_fold_straddling_boundary_requires_review():
    window = UsageWindow(datetime(2026, 11, 1, 6, tzinfo=timezone.utc), datetime(2026, 12, 1, 6, tzinfo=timezone.utc), "America/Toronto")
    with pytest.raises(ValueError, match="ambiguous"):
        window.contains_local_start(datetime(2026, 11, 1, 1, 30))


def test_nonexistent_dst_local_time_requires_review():
    window = UsageWindow(datetime(2026, 3, 1, tzinfo=timezone.utc), datetime(2026, 4, 1, tzinfo=timezone.utc), "America/Toronto")
    with pytest.raises(ValueError, match="nonexistent"):
        window.contains_local_start(datetime(2026, 3, 8, 2, 30))


@pytest.mark.parametrize("start,end", [
    (datetime(2026, 9, 1), datetime(2026, 10, 1)),
    (datetime(2026, 9, 1, tzinfo=timezone.utc), datetime(2026, 9, 1, tzinfo=timezone.utc)),
    (datetime(2026, 9, 1, tzinfo=timezone.utc), datetime(2027, 9, 1, tzinfo=timezone.utc)),
])
def test_invalid_windows_fail_closed(start, end):
    with pytest.raises(ValueError):
        UsageWindow(start, end, "UTC")
