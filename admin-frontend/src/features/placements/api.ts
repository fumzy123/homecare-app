import { apiClient } from '@/shared/lib/api-client'

export type PlacementStatus = 'open' | 'filled' | 'closed'

export interface InterestEligibility {
  availability_ok: boolean
  no_conflicts: boolean
  within_hours: boolean
  all_clear: boolean
  reasons: string[]
}

export interface InterestWorkerSummary {
  employment_id: string
  first_name: string
  last_name: string
  created_at: string
  note: string | null
  eligibility: InterestEligibility | null
}

export interface Placement {
  id: string
  org_id: string
  client_id: string
  client_first_name: string
  client_last_name: string
  created_by: string
  shift_description: string
  requirements: string | null
  masked_location: string
  status: PlacementStatus
  filled_by: string | null
  resolved_at: string | null
  created_at: string
  interest_count: number
}

export interface PlacementDetail extends Placement {
  interests: InterestWorkerSummary[]
}

export interface PlacementCreatePayload {
  client_id: string
  requirements?: string
}

export interface PlacementFillPayload {
  employment_id: string
}

export const placementsApi = {
  list: async (status?: PlacementStatus): Promise<Placement[]> => {
    const { data } = await apiClient.get('/api/placements', {
      params: status ? { status } : {},
    })
    return data
  },

  get: async (id: string): Promise<PlacementDetail> => {
    const { data } = await apiClient.get(`/api/placements/${id}`)
    return data
  },

  create: async (payload: PlacementCreatePayload): Promise<PlacementDetail> => {
    const { data } = await apiClient.post('/api/placements', payload)
    return data
  },

  fill: async (id: string, payload: PlacementFillPayload): Promise<PlacementDetail> => {
    const { data } = await apiClient.post(`/api/placements/${id}/fill`, payload)
    return data
  },

  close: async (id: string): Promise<PlacementDetail> => {
    const { data } = await apiClient.post(`/api/placements/${id}/close`, {})
    return data
  },
}
