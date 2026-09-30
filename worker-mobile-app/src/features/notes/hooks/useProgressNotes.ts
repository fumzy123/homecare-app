import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addProgressNoteEntry, getProgressNote, getRecordedNotes, type AddNoteEntry } from '../api';

export function useProgressNote(shiftId: string, occurrenceDate: string) {
  return useQuery({
    queryKey: ['progress-note', shiftId, occurrenceDate],
    queryFn: () => getProgressNote(shiftId, occurrenceDate),
    staleTime: 0,
  });
}

export function useRecordedNotes(fromDate: string, toDate: string) {
  return useQuery({
    queryKey: ['recorded-notes', fromDate, toDate],
    queryFn: () => getRecordedNotes(fromDate, toDate),
    staleTime: 0,
  });
}

export function useAddProgressNote(shiftId: string, occurrenceDate: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AddNoteEntry) => addProgressNoteEntry(shiftId, payload),
    retry: false,
    onSuccess: (note) => {
      queryClient.setQueryData(['progress-note', shiftId, occurrenceDate], note);
      void queryClient.invalidateQueries({ queryKey: ['recorded-notes'] });
    },
  });
}
