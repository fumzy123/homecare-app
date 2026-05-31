import { useQuery } from '@tanstack/react-query'
import { orgMembersApi } from '@/features/org-members/api'

export function useExpiringCredentials() {
  return useQuery({
    queryKey: ['expiring-credentials'],
    queryFn: () => orgMembersApi.listExpiringCredentials(30),
  })
}
