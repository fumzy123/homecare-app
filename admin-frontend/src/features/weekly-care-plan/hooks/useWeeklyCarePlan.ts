import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { weeklyCarePlanApi, type WeeklyCarePlanEntryInput } from '../api'

export function useWeeklyCarePlan(clientId: string) {
  return useQuery({
    queryKey: ['weekly-care-plan', clientId],
    queryFn: () => weeklyCarePlanApi.get(clientId),
    enabled: !!clientId,
  })
}

export function useSaveWeeklyCarePlan(clientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (entries: WeeklyCarePlanEntryInput[]) => weeklyCarePlanApi.put(clientId, entries),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['weekly-care-plan', clientId] })
      qc.invalidateQueries({ queryKey: ['authorization-compliance', clientId] })
    },
  })
}
