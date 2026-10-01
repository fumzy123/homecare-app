import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { weeklyCareNeedApi, type CreateWeeklyCareNeed } from '../api'
export function useCareNeedVersions(clientId: string) {
  return useQuery({ queryKey: ['weekly-care-need', clientId], queryFn: () => weeklyCareNeedApi.get(clientId), enabled: !!clientId })
}
export function useWeeklyCareNeed(clientId: string) {
  return useQuery({ queryKey: ['weekly-care-need', clientId], queryFn: () => weeklyCareNeedApi.get(clientId), enabled: !!clientId, select: versions => versions[0]?.care_slots ?? [] })
}
export function useSaveWeeklyCareNeed(clientId: string) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (payload: CreateWeeklyCareNeed) => weeklyCareNeedApi.create(clientId, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); qc.invalidateQueries({ queryKey: ['weekly-care-need', clientId] }); qc.invalidateQueries({ queryKey: ['authorization-compliance', clientId] }); qc.invalidateQueries({ queryKey: ['care-actions'] }) } })
}
