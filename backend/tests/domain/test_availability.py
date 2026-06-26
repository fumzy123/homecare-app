"""Unit tests for app.domain.availability — pure functions only (no DB)."""
from types import SimpleNamespace

from app.core.enums import WeekDay
from app.domain.availability import availability_covers_care_plan


def _avail(day: WeekDay, start_h: int, start_m: int, end_h: int, end_m: int):
    from datetime import time
    return SimpleNamespace(day_of_week=day, start_time=time(start_h, start_m), end_time=time(end_h, end_m))


def _entry(day: WeekDay, start_h: int, start_m: int, end_h: int, end_m: int):
    from datetime import time
    return SimpleNamespace(day_of_week=day, start_time=time(start_h, start_m), end_time=time(end_h, end_m))


class TestAvailabilityCoverCarePlan:
    def test_exact_match_is_covered(self):
        avail = [_avail(WeekDay.MO, 9, 0, 12, 0)]
        plan = [_entry(WeekDay.MO, 9, 0, 12, 0)]
        result = availability_covers_care_plan(avail, plan)
        assert result.covered is True

    def test_wider_availability_covers(self):
        avail = [_avail(WeekDay.MO, 7, 0, 17, 0)]
        plan = [_entry(WeekDay.MO, 9, 0, 12, 0)]
        result = availability_covers_care_plan(avail, plan)
        assert result.covered is True

    def test_narrower_availability_does_not_cover(self):
        avail = [_avail(WeekDay.MO, 10, 0, 11, 0)]
        plan = [_entry(WeekDay.MO, 9, 0, 12, 0)]
        result = availability_covers_care_plan(avail, plan)
        assert result.covered is False
        assert len(result.uncovered) == 1

    def test_wrong_day_not_covered(self):
        avail = [_avail(WeekDay.TU, 9, 0, 17, 0)]
        plan = [_entry(WeekDay.MO, 9, 0, 12, 0)]
        result = availability_covers_care_plan(avail, plan)
        assert result.covered is False

    def test_no_availability_covers_nothing(self):
        plan = [_entry(WeekDay.MO, 9, 0, 12, 0)]
        result = availability_covers_care_plan([], plan)
        assert result.covered is False

    def test_empty_care_plan_is_covered(self):
        avail = [_avail(WeekDay.MO, 9, 0, 17, 0)]
        result = availability_covers_care_plan(avail, [])
        assert result.covered is True

    def test_multiple_entries_all_covered(self):
        avail = [
            _avail(WeekDay.MO, 8, 0, 18, 0),
            _avail(WeekDay.WE, 8, 0, 18, 0),
        ]
        plan = [
            _entry(WeekDay.MO, 9, 0, 12, 0),
            _entry(WeekDay.WE, 14, 0, 16, 0),
        ]
        result = availability_covers_care_plan(avail, plan)
        assert result.covered is True

    def test_one_of_two_entries_uncovered(self):
        avail = [_avail(WeekDay.MO, 8, 0, 18, 0)]
        plan = [
            _entry(WeekDay.MO, 9, 0, 12, 0),
            _entry(WeekDay.WE, 14, 0, 16, 0),
        ]
        result = availability_covers_care_plan(avail, plan)
        assert result.covered is False
        assert len(result.uncovered) == 1

    def test_overlapping_availability_windows_merge(self):
        """Two overlapping availability windows on the same day should merge
        to cover a care plan entry that spans both."""
        avail = [
            _avail(WeekDay.MO, 8, 0, 12, 0),
            _avail(WeekDay.MO, 11, 0, 16, 0),
        ]
        plan = [_entry(WeekDay.MO, 9, 0, 15, 0)]
        result = availability_covers_care_plan(avail, plan)
        assert result.covered is True

    def test_contiguous_availability_windows_merge(self):
        """Back-to-back windows (end == start of next) should merge."""
        avail = [
            _avail(WeekDay.FR, 8, 0, 12, 0),
            _avail(WeekDay.FR, 12, 0, 17, 0),
        ]
        plan = [_entry(WeekDay.FR, 9, 0, 16, 0)]
        result = availability_covers_care_plan(avail, plan)
        assert result.covered is True

    def test_gap_between_windows_not_covered(self):
        """Two windows with a gap can't cover an entry spanning the gap."""
        avail = [
            _avail(WeekDay.MO, 8, 0, 10, 0),
            _avail(WeekDay.MO, 14, 0, 17, 0),
        ]
        plan = [_entry(WeekDay.MO, 9, 0, 15, 0)]
        result = availability_covers_care_plan(avail, plan)
        assert result.covered is False
