import { apiClient } from '@/shared/lib/api-client';

export interface NoteEntry { time: string; content: string }
export interface ProgressNote {
  id: string;
  shift_id: string;
  occurrence_date: string;
  entries: NoteEntry[];
}
export interface RecordedNote { shift_id: string; occurrence_date: string }
export interface AddNoteEntry extends NoteEntry { occurrence_date: string; expected_entry_count: number }

export async function getProgressNote(shiftId: string, occurrenceDate: string) {
  const { data } = await apiClient.get<ProgressNote | null>(`/me/shifts/${shiftId}/notes`, {
    params: { occurrence_date: occurrenceDate },
  });
  return data;
}

export async function getRecordedNotes(fromDate: string, toDate: string) {
  const { data } = await apiClient.get<RecordedNote[]>('/me/notes/recorded', {
    params: { from_date: fromDate, to_date: toDate },
  });
  return data;
}

export async function addProgressNoteEntry(shiftId: string, payload: AddNoteEntry) {
  const { data } = await apiClient.post<ProgressNote>(`/me/shifts/${shiftId}/notes`, payload);
  return data;
}
