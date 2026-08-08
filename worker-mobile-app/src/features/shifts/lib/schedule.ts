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

export function startOfMondayWeek(value: Date): Date {
  const start = new Date(value);
  const day = start.getDay();
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
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
  return shifts.filter((shift) => shift.date === dateKey);
}

export function scheduledHours(shifts: ShiftOccurrence[]): number {
  return shifts
    .filter((shift) => shift.completion_status !== 'cancelled')
    .reduce((total, shift) => {
      return total + (new Date(shift.end_time).getTime() - new Date(shift.start_time).getTime()) / 3_600_000;
    }, 0);
}

export function uniqueClientCount(shifts: ShiftOccurrence[]): number {
  return new Set(
    shifts
      .filter((shift) => shift.completion_status !== 'cancelled')
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
