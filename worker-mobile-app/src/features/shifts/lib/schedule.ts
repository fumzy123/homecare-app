import type { ShiftOccurrence } from '../types';

export type SchedulePeriod = 'week' | 'two_weeks';

export function toDateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function fromDateKey(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(value: Date, amount: number): Date {
  const next = new Date(value);
  next.setDate(next.getDate() + amount);
  return next;
}

export function startOfSundayWeek(value: Date): Date {
  const start = new Date(value);
  start.setDate(start.getDate() - start.getDay());
  start.setHours(0, 0, 0, 0);
  return start;
}

export function getPeriodDays(start: Date, period: SchedulePeriod): Date[] {
  const count = period === 'week' ? 7 : 14;
  return Array.from({ length: count }, (_, index) => addDays(start, index));
}

export function formatPeriodRange(start: Date, end: Date): string {
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    return `${start.toLocaleDateString(undefined, { month: 'short' })} ${start.getDate()} — ${end.getDate()}`;
  }
  return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} — ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

export function shiftsForDate(shifts: ShiftOccurrence[], dateKey: string): ShiftOccurrence[] {
  return shifts.filter((shift) => shift.date === dateKey)
    .sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time));
}

export function countsTowardSchedule(shift: ShiftOccurrence): boolean {
  return ['scheduled', 'in_progress', 'completed'].includes(shift.completion_status);
}

export function scheduledHours(shifts: ShiftOccurrence[]): number {
  return shifts
    .filter(countsTowardSchedule)
    .reduce((total, shift) => {
      const duration = Date.parse(shift.end_time) - Date.parse(shift.start_time);
      return total + (Number.isFinite(duration) ? Math.max(0, duration) / 3_600_000 : 0);
    }, 0);
}

export function uniqueClientCount(shifts: ShiftOccurrence[]): number {
  return new Set(
    shifts
      .filter(countsTowardSchedule)
      .map((shift) => shift.client.id),
  ).size;
}

export function serviceTypeLabel(value: string | null): string {
  if (!value) return 'Care shift';
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
