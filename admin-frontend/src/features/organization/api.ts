import { apiClient } from '@/shared/lib/api-client'

export interface Organization {
  id: string
  name: string
  owner_id: string
  is_active: boolean
  uses_authorizations: boolean
  legal_name:      string | null
  business_number: string | null
  street:          string | null
  city:            string | null
  province:        string | null
  postal_code:     string | null
  terms_accepted_at: string | null
  terms_accepted_version: string | null
  created_at: string
  updated_at: string | null
}

export interface OrganizationUpdatePayload {
  legal_name?:      string
  business_number?: string
  street?:          string
  city?:            string
  province?:        string
  postal_code?:     string
  uses_authorizations?: boolean
}

export const organizationApi = {
  getOrganization: async (): Promise<Organization> => {
    const { data } = await apiClient.get('/api/organization')
    return data
  },

  updateOrganization: async (payload: OrganizationUpdatePayload): Promise<Organization> => {
    const { data } = await apiClient.patch('/api/organization', payload)
    return data
  },
}
