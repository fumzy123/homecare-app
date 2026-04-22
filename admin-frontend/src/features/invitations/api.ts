import { apiClient } from '@/shared/lib/api-client'

export type InvitationRole = 'agency_admin' | 'home_support_worker'

export interface Invitation {
  id: string
  email: string
  role: InvitationRole
  org_id: string
  invited_by: string
  invited_at: string
  expires_at: string
  accepted_at: string | null
}

export const invitationsApi = {
  sendInvitation: async (payload: { email: string; role: InvitationRole }) => {
    const { data } = await apiClient.post('/api/invitations/', payload)
    return data
  },

  listInvitations: async (): Promise<Invitation[]> => {
    const { data } = await apiClient.get('/api/invitations/')
    return data
  },

  revokeInvitation: async (id: string) => {
    const { data } = await apiClient.delete(`/api/invitations/${id}`)
    return data
  },
}
