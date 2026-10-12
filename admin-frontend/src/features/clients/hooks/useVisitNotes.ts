import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/shared/lib/api-client'
import { shiftsApi, type ProgressNote } from '@/features/shifts/api'

export function useVisitNote(shiftId: string, date: string) {
  return useQuery({
    queryKey: ['progress-note', shiftId, date],
    queryFn: () => shiftsApi.getProgressNote(shiftId, date),
  })
}
export function useAppendVisitNote(shiftId: string, date: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (entry: {
      time: string
      content: string
      expected_entry_count: number
    }): Promise<ProgressNote> =>
      (
        await apiClient.post(`/api/shifts/${shiftId}/notes/entries`, {
          ...entry,
          occurrence_date: date,
        })
      ).data,
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['progress-note', shiftId, date] })
      void qc.invalidateQueries({ queryKey: ['client-notes'] })
    },
  })
}
