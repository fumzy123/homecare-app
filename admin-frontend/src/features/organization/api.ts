import { apiClient } from '@/shared/lib/api-client'

export interface Organization {
  id: string
  name: string
  owner_id: string
  is_active: boolean
  terms_accepted_at: string | null
  terms_accepted_version: string | null
  created_at: string
  updated_at: string | null
}

export const organizationApi = {
  getOrganization: async (): Promise<Organization> => {
    const { data } = await apiClient.get('/api/organization/')
    return data
  },
}
