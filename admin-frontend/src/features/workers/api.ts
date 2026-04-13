import { apiClient } from '@/shared/lib/api-client'

export interface Worker {
  id: string
  first_name: string
  last_name: string
  email: string
  phone_number: string | null
  role: string
  is_active: boolean
  hire_date: string | null
  created_at: string
}

export const workersApi = {
  listWorkers: async (): Promise<Worker[]> => {
    const { data } = await apiClient.get('/api/org-members/', {
      params: { role: 'home_support_worker' },
    })
    return data
  },
}
