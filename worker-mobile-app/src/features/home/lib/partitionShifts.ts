import type { ShiftOccurrence } from '../../shifts/types';

export function partitionShifts(shifts: ShiftOccurrence[], now: number) {
  const active = shifts
    .filter((shift) => ['scheduled', 'in_progress', 'completed'].includes(shift.completion_status))
    .sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time));
  const unfinished = active.filter((shift) => shift.completion_status !== 'completed');
  const current = unfinished.find((shift) => Date.parse(shift.start_time) <= now && now < Date.parse(shift.end_time)) ?? null;
  const upcoming = unfinished.filter((shift) => Date.parse(shift.start_time) > now);
  const next = upcoming[0] ?? null;
  return { current, next, later: upcoming.slice(1), total: active.length, nextIndex: next ? active.indexOf(next) + 1 : 0 };
}
