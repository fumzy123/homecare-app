import type { RecordedNote } from '../../notes/api';
import type { ShiftOccurrence } from '../types';
import { addDays, countsTowardSchedule, fromDateKey, getPeriodDays, scheduledHours, shiftsForDate, startOfSundayWeek, toDateKey, type SchedulePeriod } from './schedule';

export type ScheduleLayout = 'day' | 'list';
export type ScheduleNoteStatus = 'saved' | 'needed' | 'unknown' | null;
export interface ScheduleVisit {
  shift: ShiftOccurrence;
  isNext: boolean;
  isScheduledNow: boolean;
  noteStatus: ScheduleNoteStatus;
  gapMinutes: number | null;
}
export interface ScheduleDay {
  date: Date;
  key: string;
  visits: ScheduleVisit[];
  hours: number;
  visitCount: number;
  finish: string | null;
}
export interface ScheduleSelection {
  period: SchedulePeriod;
  start: Date;
  selectedDate: string;
  layout: ScheduleLayout;
}

/** Keep an existing two-week window when selecting its second week. No payroll anchor is assumed. */
export function selectScheduleDate(selection: ScheduleSelection, date: Date): ScheduleSelection {
  const key = toDateKey(date);
  const end = toDateKey(addDays(selection.start, selection.period === 'week' ? 6 : 13));
  return { ...selection, selectedDate: key, layout: 'day',
    start: key >= toDateKey(selection.start) && key <= end ? selection.start : startOfSundayWeek(date) };
}

export function changeSchedulePeriod(selection: ScheduleSelection, period: SchedulePeriod): ScheduleSelection {
  return { ...selection, period, start: startOfSundayWeek(fromDateKey(selection.selectedDate)) };
}

export function moveSchedulePeriod(selection: ScheduleSelection, direction: -1 | 1): ScheduleSelection {
  const days = (selection.period === 'week' ? 7 : 14) * direction;
  return { ...selection, start: addDays(selection.start, days), selectedDate: toDateKey(addDays(fromDateKey(selection.selectedDate), days)) };
}

export function occurrenceKey(shift: Pick<ShiftOccurrence, 'shift_id' | 'date'>): string {
  return `${shift.shift_id}:${shift.date}`;
}

export function shiftAddress(shift: ShiftOccurrence): string {
  return shift.location?.trim() || [shift.client.street, shift.client.city].filter(Boolean).join(', ');
}

export function formatScheduleHours(hours: number): string {
  return String(Number(hours.toFixed(1)));
}

export function formatGap(minutes: number): string {
  const value = Math.abs(minutes);
  const hours = Math.floor(value / 60);
  const remainder = value % 60;
  return [hours ? `${hours} hr${hours === 1 ? '' : 's'}` : '', remainder || !hours ? `${remainder} min` : ''].filter(Boolean).join(' ');
}

export function calendarMonthCells(month: Date): (Date | null)[][] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((first.getDay() + count) / 7) * 7 }, (_, i) => {
    const day = i - first.getDay() + 1;
    return day < 1 || day > count ? null : new Date(month.getFullYear(), month.getMonth(), day);
  });
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
}

/** Pure projection: fetching, navigation and device actions belong to the orchestration layer. */
export function buildScheduleDays(start: Date, period: SchedulePeriod, shifts: ShiftOccurrence[], notes: RecordedNote[] | undefined, now: number): ScheduleDay[] {
  const noteKeys = new Set(notes?.map(n => `${n.shift_id}:${n.occurrence_date}`));
  const todayKey = toDateKey(new Date(now));
  return getPeriodDays(start, period).map(date => {
    const key = toDateKey(date);
    const dayShifts = shiftsForDate(shifts, key);
    const counted = dayShifts.filter(countsTowardSchedule);
    const next = key === todayKey ? dayShifts.find(s => s.completion_status === 'scheduled' && Date.parse(s.start_time) > now) : undefined;
    let previousEnd: number | null = null;
    const visits = dayShifts.map(shift => {
      const eligible = countsTowardSchedule(shift);
      const startTime = Date.parse(shift.start_time), endTime = Date.parse(shift.end_time);
      const gapMinutes = eligible && previousEnd !== null ? Math.round((startTime - previousEnd) / 60_000) : null;
      if (eligible) previousEnd = Math.max(previousEnd ?? endTime, endTime);
      const noteStatus: ScheduleNoteStatus = shift.completion_status !== 'completed' ? null
        : notes === undefined ? 'unknown' : noteKeys.has(occurrenceKey(shift)) ? 'saved' : 'needed';
      return { shift, isNext: shift === next, gapMinutes, noteStatus,
        isScheduledNow: shift.completion_status === 'scheduled' && startTime <= now && now < endTime };
    });
    const last = counted.reduce<ShiftOccurrence | null>((latest, shift) => !latest || Date.parse(shift.end_time) > Date.parse(latest.end_time) ? shift : latest, null);
    return { date, key, visits, hours: scheduledHours(dayShifts), visitCount: counted.length, finish: last?.end_time ?? null };
  });
}
