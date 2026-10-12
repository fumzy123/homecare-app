import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { invitationsApi } from '../api'

export function useInvitations() {
  return useQuery({ queryKey: ['invitations'], queryFn: invitationsApi.listInvitations })
}
export function useRevokeInvitation() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: invitationsApi.revokeInvitation, onSuccess: () => qc.invalidateQueries({ queryKey: ['invitations'] }) })
}
export function useResendInvitation(onSent: (id: string) => void) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: invitationsApi.resendInvitation, onSuccess: (_, id) => {
    void qc.invalidateQueries({ queryKey: ['invitations'] }); onSent(id)
  } })
}
