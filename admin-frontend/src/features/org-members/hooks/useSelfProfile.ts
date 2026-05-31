import { useQuery } from '@tanstack/react-query'
import { orgMembersApi } from '@/features/org-members/api'
import { useAuthStore } from '@/shared/stores/auth'

export function useSelfProfile() {
  const { user } = useAuthStore()
  return useQuery({
    queryKey: ['org-member-self', user?.id],
    queryFn:  () => orgMembersApi.getOrgMember(user!.id),
    enabled:  !!user?.id,
  })
}
