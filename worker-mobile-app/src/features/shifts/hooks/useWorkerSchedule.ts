import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useRecordedNotes } from '@/features/notes/hooks/useProgressNotes';
import { useMinuteClock } from '@/shared/hooks/useMinuteClock';
import { useRefreshControl } from '@/shared/hooks/useRefreshControl';
import { addDays, startOfSundayWeek, toDateKey, type SchedulePeriod } from '../lib/schedule';
import { buildScheduleDays, changeSchedulePeriod, moveSchedulePeriod, selectScheduleDate, type ScheduleLayout, type ScheduleSelection } from '../lib/scheduleView';
import { useMyShifts } from './useMyShifts';

/** Layer 3 hook: period selection, queries and refresh lifecycle for the schedule. */
export function useWorkerSchedule() {
  const now = useMinuteClock();
  const [selection, setSelection] = useState<ScheduleSelection>(() => ({
    period: 'week', start: startOfSundayWeek(new Date()), selectedDate: toDateKey(new Date()), layout: 'day',
  }));
  const fromDate = toDateKey(selection.start);
  const end = addDays(selection.start, selection.period === 'week' ? 6 : 13);
  const toDate = toDateKey(end);
  const shifts = useMyShifts(fromDate, toDate);
  const notes = useRecordedNotes(fromDate, toDate);
  const refreshAll = useCallback(() => Promise.all([shifts.refetch(), notes.refetch()]), [shifts.refetch, notes.refetch]);
  useFocusEffect(useCallback(() => { void refreshAll(); }, [refreshAll]));
  const refresh = useRefreshControl(refreshAll);
  const days = useMemo(() => buildScheduleDays(selection.start, selection.period, shifts.data ?? [], notes.isSuccess ? notes.data : undefined, now),
    [selection.start, selection.period, shifts.data, notes.isSuccess, notes.data, now]);
  const selectedDay = days.find(day => day.key === selection.selectedDate)!;
  function selectDate(date: Date) { setSelection(current => selectScheduleDate(current, date)); }
  function changePeriod(period: SchedulePeriod) { setSelection(current => changeSchedulePeriod(current, period)); }
  function movePeriod(direction: -1 | 1) { setSelection(current => moveSchedulePeriod(current, direction)); }
  function changeLayout(layout: ScheduleLayout) { setSelection(current => ({ ...current, layout })); }
  function returnToToday() { selectDate(new Date()); }
  const nextWorkingDay = days.find(day => day.key > selection.selectedDate && day.visitCount > 0);
  return { selection, end, now, days, selectedDay, shifts, notes, refresh, selectDate, changePeriod, movePeriod, changeLayout, returnToToday,
    nextWorkingDay, hours: days.reduce((total, day) => total + day.hours, 0), visitCount: days.reduce((total, day) => total + day.visitCount, 0) };
}
