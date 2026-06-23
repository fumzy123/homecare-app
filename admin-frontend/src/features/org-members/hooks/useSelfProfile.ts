import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/shared/lib/api-client'
import type { OrgMember } from '@/features/org-members/api'

export function useSelfProfile() {
  return useQuery({
    queryKey: ['org-member-self'],
    queryFn:  async (): Promise<OrgMember> => {
      const { data } = await apiClient.get('/api/org-members/me')
      return data
    },
  })
}
