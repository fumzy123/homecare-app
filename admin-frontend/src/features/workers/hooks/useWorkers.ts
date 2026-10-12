import { useQuery } from '@tanstack/react-query'
import { orgMembersApi } from '@/features/org-members/api'

export function useWorkers() {
  return useQuery({
    queryKey: ['workers'],
    refetchInterval: 60_000,
    queryFn:  () => orgMembersApi.listByRole('home_support_worker'),
  })
}

export function useWorker(workerId: string) {
  return useQuery({ queryKey: ['worker', workerId], queryFn: () => orgMembersApi.getOrgMember(workerId), enabled: !!workerId, refetchInterval: 60_000 })
}
