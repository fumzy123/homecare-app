import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authorizationsApi, type CareScheduleBlockInput } from '../api'

export function useCareSchedule(clientId: string) {
  return useQuery({
    queryKey: ['care-schedule', clientId],
    queryFn: () => authorizationsApi.getCareSchedule(clientId),
    enabled: !!clientId,
  })
}

export function useSaveCareSchedule(clientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (blocks: CareScheduleBlockInput[]) => authorizationsApi.putCareSchedule(clientId, blocks),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['care-schedule', clientId] })
      qc.invalidateQueries({ queryKey: ['authorization-compliance', clientId] })
    },
  })
}
