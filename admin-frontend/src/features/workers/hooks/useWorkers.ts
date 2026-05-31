import { useQuery } from '@tanstack/react-query'
import { orgMembersApi } from '@/features/org-members/api'

export function useWorkers() {
  return useQuery({
    queryKey: ['workers'],
    queryFn:  () => orgMembersApi.listByRole('home_support_worker'),
  })
}
