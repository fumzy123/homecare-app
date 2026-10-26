import { useQuery } from '@tanstack/react-query'
import { orgMembersApi } from '@/features/org-members/api'
import { invitationsApi } from '@/features/invitations/api'
import { STAFF_ROLES } from '@/features/invitations/constants'

// Refresh after an invite is accepted in another window, without resetting the tab.
const refresh = { staleTime: 0, refetchOnWindowFocus: true, refetchOnReconnect: true, refetchInterval: 60_000 } as const

export function useTeamDirectory() {
  const owners = useQuery({
    queryKey: ['org-members', 'owner'],
    queryFn: () => orgMembersApi.listByRole('owner'),
    ...refresh,
  })
  const staff = useQuery({
    queryKey: ['org-members', 'staff'],
    queryFn: async () => {
      const groups = await Promise.all(STAFF_ROLES.map(role => orgMembersApi.listByRole(role)))
      return groups.flat().sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`))
    },
    ...refresh,
  })
  const invitations = useQuery({
    queryKey: ['invitations'],
    queryFn: invitationsApi.listInvitations,
    ...refresh,
  })
  return { owners, staff, invitations }
}
