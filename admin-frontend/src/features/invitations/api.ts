import { apiClient } from '@/shared/lib/api-client'

export type InvitationRole =
  | 'manager'
  | 'supervisor'
  | 'financial_officer'
  | 'nurse'
  | 'home_support_worker'

export type EmploymentType = 'full_time' | 'part_time'

export interface Invitation {
  id: string
  email: string
  role: InvitationRole
  org_id: string
  invited_by: string
  invited_at: string
  expires_at: string  // computed server-side, not stored
  accepted_at: string | null
}

export const invitationsApi = {
  sendInvitation: async (payload: { email: string; role: InvitationRole; employment_type: EmploymentType }) => {
    const { data } = await apiClient.post('/api/invitations', payload)
    return data
  },

  listInvitations: async (): Promise<Invitation[]> => {
    const { data } = await apiClient.get('/api/invitations')
    return data
  },

  resendInvitation: async (id: string) => {
    const { data } = await apiClient.post(`/api/invitations/${id}/resend`)
    return data
  },

  revokeInvitation: async (id: string) => {
    const { data } = await apiClient.delete(`/api/invitations/${id}`)
    return data
  },
}
