import { addDays, toDateKey } from '../../shifts/lib/schedule';
import type { ShiftOccurrence } from '../../shifts/types';
import type { RecordedNote } from '../../notes/api';
import { partitionShifts } from './partitionShifts';

export function homeDateRange(now: number) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  // Match the Sunday–Saturday reporting week used by the backend worker stats.
  const weekStart = addDays(today, -today.getDay());
  const weekEnd = addDays(weekStart, 7);
  const tomorrow = addDays(today, 1);
  return { today, tomorrow, weekStart, weekEnd, fromDate: toDateKey(addDays(today, -7)), toDate: toDateKey(new Date(Math.max(addDays(weekEnd, -1).getTime(), tomorrow.getTime()))) };
}

export function homeSummary(shifts: ShiftOccurrence[], recordedNotes: RecordedNote[], now: number) {
  const range = homeDateRange(now);
  const eligible = shifts.filter(s => ['scheduled', 'in_progress', 'completed'].includes(s.completion_status));
  const today = eligible.filter(s => Date.parse(s.start_time) < range.tomorrow.getTime() && Date.parse(s.end_time) > range.today.getTime());
  const partition = partitionShifts(today, now);
  const tomorrow = eligible.filter(s => toDateKey(new Date(s.start_time)) === toDateKey(range.tomorrow) && s.completion_status !== 'completed')
    .sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time));
  // Completed scheduled durations are provisional until EVV supplies actual time.
  const completedHours = eligible.filter(s => s.completion_status === 'completed' && Date.parse(s.end_time) <= now)
    .reduce((total, s) => total + Math.max(0, Math.min(Date.parse(s.end_time), range.weekEnd.getTime()) - Math.max(Date.parse(s.start_time), range.weekStart.getTime())) / 3_600_000, 0);
  const scheduledHours = eligible.reduce((total, s) => total + Math.max(0, Math.min(Date.parse(s.end_time), range.weekEnd.getTime()) - Math.max(Date.parse(s.start_time), range.weekStart.getTime())) / 3_600_000, 0);
  const recorded = new Set(recordedNotes.map(note => `${note.shift_id}:${note.occurrence_date}`));
  const pendingNotes = eligible.filter(s => s.completion_status === 'completed' && Date.parse(s.start_time) >= addDays(range.today, -6).getTime() && Date.parse(s.end_time) <= now && !recorded.has(`${s.shift_id}:${s.date}`))
    .sort((a, b) => Date.parse(b.end_time) - Date.parse(a.end_time));
  const lastEnd = today.length ? Math.max(...today.map(s => Date.parse(s.end_time))) : null;
  const previous = partition.current ?? today.filter(s => Date.parse(s.end_time) <= now)
    .sort((a, b) => Date.parse(b.end_time) - Date.parse(a.end_time))[0];
  return { ...partition, tomorrow, pendingNotes, completedHours, scheduledHours, lastEnd,
    currentIndex: partition.current ? [...today].sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time)).indexOf(partition.current) + 1 : 0,
    gapMinutes: previous && partition.next ? Math.max(0, Math.round((Date.parse(partition.next.start_time) - Date.parse(previous.end_time)) / 60_000)) : null,
  };
}
