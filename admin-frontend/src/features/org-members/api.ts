import { apiClient } from '@/shared/lib/api-client'

export interface OrgMember {
  id: string
  first_name: string
  last_name: string
  email: string
  role: string
  phone_number: string | null
  gender: string | null
  date_of_birth: string | null
  is_active: boolean
  created_at: string
}

export interface OrgMemberSelfUpdatePayload {
  first_name?: string
  last_name?: string
  email?: string
  phone_number?: string
  gender?: string
  date_of_birth?: string
}

export const orgMembersApi = {
  listByRole: async (role: 'owner' | 'agency_admin'): Promise<OrgMember[]> => {
    const { data } = await apiClient.get(`/api/org-members?role=${role}`)
    return data
  },

  getOrgMember: async (memberId: string): Promise<OrgMember> => {
    const { data } = await apiClient.get(`/api/org-members/${memberId}`)
    return data
  },

  updateOrgMember: async (memberId: string, payload: OrgMemberSelfUpdatePayload): Promise<OrgMember> => {
    const { data } = await apiClient.patch(`/api/org-members/${memberId}`, payload)
    return data
  },
}
