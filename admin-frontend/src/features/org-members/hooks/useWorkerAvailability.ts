import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { orgMembersApi, type AvailabilityBlockInput, type WeekDay } from '../api'

export function useWorkerAvailability(memberId: string) {
  return useQuery({
    queryKey: ['worker-availability', memberId],
    queryFn:  () => orgMembersApi.getAvailability(memberId),
    enabled:  !!memberId,
  })
}

export function useSaveWorkerAvailability(memberId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (blocks: AvailabilityBlockInput[]) => orgMembersApi.putAvailability(memberId, blocks),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['worker-availability', memberId] })
      qc.invalidateQueries({ queryKey: ['worker', memberId] })
    },
  })
}

/** Employment ids available for a block — enabled only when all params are set. */
export function useAvailableMembers(day: WeekDay | null, start: string | null, end: string | null) {
  return useQuery({
    queryKey: ['available-members', day, start, end],
    queryFn:  () => orgMembersApi.getAvailableMembers(day!, start!, end!),
    enabled:  !!day && !!start && !!end,
  })
}
