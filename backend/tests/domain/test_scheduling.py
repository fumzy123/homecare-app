"""Unit tests for app.domain.scheduling — pure functions only (no DB)."""
from datetime import date, datetime, time, timedelta
from types import SimpleNamespace

from app.core.enums import RecurrenceFrequency, ShiftCompletionStatus, WeekDay
from app.domain.scheduling import (
    WEEKDAY_INDEX,
    build_rrule_string,
    expand_occurrences,
    expand_rule_to_time_blocks,
    hours_by_week,
    iso_week_range,
    shift_has_occurrence_on,
    timeblock_for_occurrence,
    times_overlap,
    weekly_entries_to_time_blocks,
)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _make_shift(start, end, is_recurring=False, rule=None, recurrence_end=None):
    """Build a minimal Shift-like object for the pure functions."""
    return SimpleNamespace(
        start_time=start,
        end_time=end,
        is_recurring=is_recurring,
        recurrence_rule=rule,
        recurrence_end_date=recurrence_end,
    )


def _make_entry(day: WeekDay, start: time, end: time):
    """Build a minimal weekly-entry-like object (care plan or availability)."""
    return SimpleNamespace(day_of_week=day, start_time=start, end_time=end)


def _make_mod(original_date, status=None, new_start=None, new_end=None):
    return SimpleNamespace(
        original_date=original_date,
        completion_status=status,
        new_start_time=new_start,
        new_end_time=new_end,
    )


# ── WEEKDAY_INDEX ────────────────────────────────────────────────────────────

class TestWeekdayIndex:
    def test_monday_is_zero(self):
        assert WEEKDAY_INDEX[WeekDay.MO] == 0

    def test_sunday_is_six(self):
        assert WEEKDAY_INDEX[WeekDay.SU] == 6

    def test_all_seven_days_present(self):
        assert len(WEEKDAY_INDEX) == 7


# ── build_rrule_string ───────────────────────────────────────────────────────

class TestBuildRruleString:
    def test_daily(self):
        assert build_rrule_string(RecurrenceFrequency.daily) == "FREQ=DAILY"

    def test_daily_ignores_days_of_week(self):
        assert build_rrule_string(RecurrenceFrequency.daily, ["MO", "TU"]) == "FREQ=DAILY"

    def test_weekly_with_days(self):
        result = build_rrule_string(RecurrenceFrequency.weekly, ["MO", "WE", "FR"])
        assert result == "FREQ=WEEKLY;BYDAY=MO,WE,FR"

    def test_weekly_single_day(self):
        result = build_rrule_string(RecurrenceFrequency.weekly, ["TU"])
        assert result == "FREQ=WEEKLY;BYDAY=TU"

    def test_weekly_no_days_defaults_empty(self):
        result = build_rrule_string(RecurrenceFrequency.weekly)
        assert result == "FREQ=WEEKLY;BYDAY="


# ── expand_rule_to_time_blocks ───────────────────────────────────────────────

class TestExpandRuleToTimeBlocks:
    def test_daily_rule_three_days(self):
        dtstart = datetime(2026, 1, 5, 9, 0)  # Monday
        blocks = expand_rule_to_time_blocks("FREQ=DAILY", dtstart, timedelta(hours=2), date(2026, 1, 7))
        assert len(blocks) == 3
        assert blocks[0] == (date(2026, 1, 5), datetime(2026, 1, 5, 9, 0), datetime(2026, 1, 5, 11, 0))

    def test_weekly_rule(self):
        dtstart = datetime(2026, 1, 5, 14, 0)  # Monday
        blocks = expand_rule_to_time_blocks("FREQ=WEEKLY;BYDAY=MO", dtstart, timedelta(hours=1), date(2026, 1, 19))
        dates = [b[0] for b in blocks]
        assert dates == [date(2026, 1, 5), date(2026, 1, 12), date(2026, 1, 19)]

    def test_cap_date_limits_expansion(self):
        dtstart = datetime(2026, 1, 5, 9, 0)
        blocks = expand_rule_to_time_blocks("FREQ=DAILY", dtstart, timedelta(hours=1), date(2026, 1, 5))
        assert len(blocks) == 1

    def test_duration_applied_correctly(self):
        dtstart = datetime(2026, 3, 1, 8, 0)
        blocks = expand_rule_to_time_blocks("FREQ=DAILY", dtstart, timedelta(hours=3, minutes=30), date(2026, 3, 1))
        _, start, end = blocks[0]
        assert end - start == timedelta(hours=3, minutes=30)


# ── expand_occurrences ───────────────────────────────────────────────────────

class TestExpandOccurrences:
    def test_single_shift_in_range(self):
        shift = _make_shift(datetime(2026, 6, 15, 9, 0), datetime(2026, 6, 15, 11, 0))
        result = expand_occurrences(shift, date(2026, 6, 1), date(2026, 6, 30))
        assert result == [date(2026, 6, 15)]

    def test_single_shift_out_of_range(self):
        shift = _make_shift(datetime(2026, 6, 15, 9, 0), datetime(2026, 6, 15, 11, 0))
        result = expand_occurrences(shift, date(2026, 7, 1), date(2026, 7, 31))
        assert result == []

    def test_recurring_daily(self):
        shift = _make_shift(
            datetime(2026, 1, 5, 9, 0), datetime(2026, 1, 5, 10, 0),
            is_recurring=True, rule="FREQ=DAILY",
        )
        result = expand_occurrences(shift, date(2026, 1, 5), date(2026, 1, 7))
        assert result == [date(2026, 1, 5), date(2026, 1, 6), date(2026, 1, 7)]

    def test_recurring_respects_recurrence_end(self):
        shift = _make_shift(
            datetime(2026, 1, 5, 9, 0), datetime(2026, 1, 5, 10, 0),
            is_recurring=True, rule="FREQ=DAILY", recurrence_end=date(2026, 1, 6),
        )
        result = expand_occurrences(shift, date(2026, 1, 5), date(2026, 1, 10))
        assert result == [date(2026, 1, 5), date(2026, 1, 6)]

    def test_recurring_weekly(self):
        shift = _make_shift(
            datetime(2026, 1, 5, 9, 0), datetime(2026, 1, 5, 10, 0),  # Monday
            is_recurring=True, rule="FREQ=WEEKLY;BYDAY=MO,WE",
        )
        result = expand_occurrences(shift, date(2026, 1, 5), date(2026, 1, 11))
        assert date(2026, 1, 5) in result   # Monday
        assert date(2026, 1, 7) in result   # Wednesday


# ── shift_has_occurrence_on ──────────────────────────────────────────────────

class TestShiftHasOccurrenceOn:
    def test_single_shift_matching_date(self):
        shift = _make_shift(datetime(2026, 3, 10, 8, 0), datetime(2026, 3, 10, 12, 0))
        assert shift_has_occurrence_on(shift, date(2026, 3, 10)) is True

    def test_single_shift_different_date(self):
        shift = _make_shift(datetime(2026, 3, 10, 8, 0), datetime(2026, 3, 10, 12, 0))
        assert shift_has_occurrence_on(shift, date(2026, 3, 11)) is False

    def test_recurring_on_valid_day(self):
        shift = _make_shift(
            datetime(2026, 1, 5, 9, 0), datetime(2026, 1, 5, 10, 0),
            is_recurring=True, rule="FREQ=WEEKLY;BYDAY=MO",
        )
        assert shift_has_occurrence_on(shift, date(2026, 1, 12)) is True  # next Monday

    def test_recurring_on_wrong_day(self):
        shift = _make_shift(
            datetime(2026, 1, 5, 9, 0), datetime(2026, 1, 5, 10, 0),
            is_recurring=True, rule="FREQ=WEEKLY;BYDAY=MO",
        )
        assert shift_has_occurrence_on(shift, date(2026, 1, 6)) is False  # Tuesday

    def test_recurring_past_end_date(self):
        shift = _make_shift(
            datetime(2026, 1, 5, 9, 0), datetime(2026, 1, 5, 10, 0),
            is_recurring=True, rule="FREQ=WEEKLY;BYDAY=MO", recurrence_end=date(2026, 1, 10),
        )
        assert shift_has_occurrence_on(shift, date(2026, 1, 12)) is False


# ── timeblock_for_occurrence ─────────────────────────────────────────────────

class TestTimeblockForOccurrence:
    def test_no_modification_returns_default_block(self):
        shift = _make_shift(datetime(2026, 6, 1, 9, 0), datetime(2026, 6, 1, 11, 0))
        result = timeblock_for_occurrence(shift, date(2026, 6, 8), {})
        assert result == (datetime(2026, 6, 8, 9, 0), datetime(2026, 6, 8, 11, 0))

    def test_cancelled_modification_returns_none(self):
        mod = _make_mod(date(2026, 6, 8), status=ShiftCompletionStatus.cancelled)
        result = timeblock_for_occurrence(
            _make_shift(datetime(2026, 6, 1, 9, 0), datetime(2026, 6, 1, 11, 0)),
            date(2026, 6, 8),
            {date(2026, 6, 8): mod},
        )
        assert result is None

    def test_time_override_modification(self):
        new_start = datetime(2026, 6, 8, 10, 0)
        new_end = datetime(2026, 6, 8, 14, 0)
        mod = _make_mod(date(2026, 6, 8), new_start=new_start, new_end=new_end)
        result = timeblock_for_occurrence(
            _make_shift(datetime(2026, 6, 1, 9, 0), datetime(2026, 6, 1, 11, 0)),
            date(2026, 6, 8),
            {date(2026, 6, 8): mod},
        )
        assert result == (new_start, new_end)

    def test_modification_on_different_date_ignored(self):
        mod = _make_mod(date(2026, 6, 9), status=ShiftCompletionStatus.cancelled)
        shift = _make_shift(datetime(2026, 6, 1, 9, 0), datetime(2026, 6, 1, 11, 0))
        result = timeblock_for_occurrence(shift, date(2026, 6, 8), {date(2026, 6, 9): mod})
        assert result is not None


# ── times_overlap ────────────────────────────────────────────────────────────

class TestTimesOverlap:
    def test_overlapping(self):
        assert times_overlap(
            datetime(2026, 1, 1, 9, 0), datetime(2026, 1, 1, 11, 0),
            datetime(2026, 1, 1, 10, 0), datetime(2026, 1, 1, 12, 0),
        ) is True

    def test_no_overlap_before(self):
        assert times_overlap(
            datetime(2026, 1, 1, 9, 0), datetime(2026, 1, 1, 10, 0),
            datetime(2026, 1, 1, 10, 0), datetime(2026, 1, 1, 11, 0),
        ) is False

    def test_no_overlap_after(self):
        assert times_overlap(
            datetime(2026, 1, 1, 12, 0), datetime(2026, 1, 1, 13, 0),
            datetime(2026, 1, 1, 10, 0), datetime(2026, 1, 1, 11, 0),
        ) is False

    def test_contained(self):
        assert times_overlap(
            datetime(2026, 1, 1, 9, 0), datetime(2026, 1, 1, 17, 0),
            datetime(2026, 1, 1, 10, 0), datetime(2026, 1, 1, 12, 0),
        ) is True

    def test_exact_same_window(self):
        assert times_overlap(
            datetime(2026, 1, 1, 9, 0), datetime(2026, 1, 1, 11, 0),
            datetime(2026, 1, 1, 9, 0), datetime(2026, 1, 1, 11, 0),
        ) is True

    def test_adjacent_windows_no_overlap(self):
        """Back-to-back shifts (end == start of next) should NOT overlap."""
        assert times_overlap(
            datetime(2026, 1, 1, 9, 0), datetime(2026, 1, 1, 10, 0),
            datetime(2026, 1, 1, 10, 0), datetime(2026, 1, 1, 11, 0),
        ) is False


# ── iso_week_range ───────────────────────────────────────────────────────────

class TestIsoWeekRange:
    def test_sunday_returns_same_sunday(self):
        sun, sat = iso_week_range(date(2026, 6, 21))  # Sunday
        assert sun == date(2026, 6, 21)
        assert sat == date(2026, 6, 27)

    def test_wednesday_mid_week(self):
        sun, sat = iso_week_range(date(2026, 6, 24))  # Wednesday
        assert sun == date(2026, 6, 21)
        assert sat == date(2026, 6, 27)

    def test_saturday_end_of_week(self):
        sun, sat = iso_week_range(date(2026, 6, 27))  # Saturday
        assert sun == date(2026, 6, 21)
        assert sat == date(2026, 6, 27)

    def test_range_is_always_seven_days(self):
        sun, sat = iso_week_range(date(2026, 3, 18))
        assert (sat - sun).days == 6


# ── weekly_entries_to_time_blocks ────────────────────────────────────────────

class TestWeeklyEntriesToTimeBlocks:
    def test_single_entry_one_week(self):
        entries = [_make_entry(WeekDay.MO, time(9, 0), time(11, 0))]
        blocks = weekly_entries_to_time_blocks(entries, date(2026, 1, 5), date(2026, 1, 11))
        assert len(blocks) == 1
        d, start, end = blocks[0]
        assert d == date(2026, 1, 5)  # Monday
        assert start == datetime(2026, 1, 5, 9, 0)
        assert end == datetime(2026, 1, 5, 11, 0)

    def test_two_weeks_doubles_occurrences(self):
        entries = [_make_entry(WeekDay.MO, time(9, 0), time(11, 0))]
        blocks = weekly_entries_to_time_blocks(entries, date(2026, 1, 5), date(2026, 1, 18))
        mondays = [b[0] for b in blocks]
        assert mondays == [date(2026, 1, 5), date(2026, 1, 12)]

    def test_multiple_entries_same_day(self):
        entries = [
            _make_entry(WeekDay.TU, time(8, 0), time(10, 0)),
            _make_entry(WeekDay.TU, time(14, 0), time(16, 0)),
        ]
        blocks = weekly_entries_to_time_blocks(entries, date(2026, 1, 6), date(2026, 1, 6))
        assert len(blocks) == 2

    def test_no_matching_days_returns_empty(self):
        entries = [_make_entry(WeekDay.SA, time(9, 0), time(11, 0))]
        blocks = weekly_entries_to_time_blocks(entries, date(2026, 1, 5), date(2026, 1, 9))  # Mon-Fri
        assert blocks == []

    def test_empty_entries(self):
        assert weekly_entries_to_time_blocks([], date(2026, 1, 1), date(2026, 12, 31)) == []


# ── hours_by_week ────────────────────────────────────────────────────────────

def _make_shift_with_mods(start, end, modifications=None, is_recurring=False, rule=None, recurrence_end=None):
    shift = _make_shift(start, end, is_recurring=is_recurring, rule=rule, recurrence_end=recurrence_end)
    shift.modifications = modifications or []
    return shift


class TestHoursByWeek:
    def test_single_shift_one_week(self):
        shift = _make_shift_with_mods(datetime(2026, 6, 22, 9, 0), datetime(2026, 6, 22, 13, 0))  # Mon, 4h
        result = hours_by_week([shift], date(2026, 6, 21), date(2026, 6, 27))
        assert result == {(date(2026, 6, 21), date(2026, 6, 27)): 4.0}

    def test_no_shifts_returns_empty_dict(self):
        assert hours_by_week([], date(2026, 6, 1), date(2026, 6, 30)) == {}

    def test_shift_out_of_range_excluded(self):
        shift = _make_shift_with_mods(datetime(2026, 5, 1, 9, 0), datetime(2026, 5, 1, 13, 0))
        assert hours_by_week([shift], date(2026, 6, 1), date(2026, 6, 30)) == {}

    def test_recurring_shift_buckets_across_weeks(self):
        shift = _make_shift_with_mods(
            datetime(2026, 6, 22, 9, 0), datetime(2026, 6, 22, 11, 0),  # Mon, 2h
            is_recurring=True, rule="FREQ=WEEKLY;BYDAY=MO",
        )
        result = hours_by_week([shift], date(2026, 6, 21), date(2026, 7, 4))
        # Two Mondays: Jun 22 (week of 21st) and Jun 29 (week of 28th)
        assert result == {
            (date(2026, 6, 21), date(2026, 6, 27)): 2.0,
            (date(2026, 6, 28), date(2026, 7, 4)): 2.0,
        }

    def test_cancelled_occurrence_contributes_zero(self):
        mod = _make_mod(date(2026, 6, 22), status=ShiftCompletionStatus.cancelled)
        shift = _make_shift_with_mods(
            datetime(2026, 6, 22, 9, 0), datetime(2026, 6, 22, 13, 0), modifications=[mod],
        )
        assert hours_by_week([shift], date(2026, 6, 21), date(2026, 6, 27)) == {}

    def test_time_override_modification_changes_hours(self):
        # Default would be 4h; override makes it 2h.
        mod = _make_mod(
            date(2026, 6, 22),
            new_start=datetime(2026, 6, 22, 9, 0),
            new_end=datetime(2026, 6, 22, 11, 0),
        )
        shift = _make_shift_with_mods(
            datetime(2026, 6, 22, 9, 0), datetime(2026, 6, 22, 13, 0), modifications=[mod],
        )
        result = hours_by_week([shift], date(2026, 6, 21), date(2026, 6, 27))
        assert result == {(date(2026, 6, 21), date(2026, 6, 27)): 2.0}

    def test_multiple_shifts_same_week_sum(self):
        s1 = _make_shift_with_mods(datetime(2026, 6, 22, 9, 0), datetime(2026, 6, 22, 12, 0))  # 3h
        s2 = _make_shift_with_mods(datetime(2026, 6, 24, 9, 0), datetime(2026, 6, 24, 14, 0))  # 5h
        result = hours_by_week([s1, s2], date(2026, 6, 21), date(2026, 6, 27))
        assert result == {(date(2026, 6, 21), date(2026, 6, 27)): 8.0}
