import { apiClient } from '@/shared/lib/api-client'
import type { WeekDay } from '@/features/weekly-care-need/types'

export interface Assignment {
  id: string
  client_id: string
  client_name: string
  worker_id: string
  worker_name: string
  placement_id: string
  care_slot_id: string
  day_of_week: WeekDay
  start_time: string
  end_time: string
  starts_on: string
  stops_from: string | null
  revision_ends_on: string | null
  end_reason: string | null
  assignment_source?: 'worker_interest' | 'admin_arranged'
  ended_at: string | null
  status: 'active' | 'scheduled' | 'ending' | 'ended'
  can_end: boolean
}
export type AssignmentFilter = { worker_id?: string; client_id?: string }
export interface EndAssignments {
  assignment_ids: string[]
  stops_from: string
  reason: string
  review_token?: string
}
export interface EndReview {
  review_token: string
  stops_from: string
  assignments: Assignment[]
  series_count: number
}
export const assignmentsApi = {
  list: async (filter: AssignmentFilter): Promise<{ today: string; assignments: Assignment[] }> =>
    (await apiClient.get('/api/assignments', { params: filter })).data,
  review: async (payload: EndAssignments): Promise<EndReview> =>
    (await apiClient.post('/api/assignments/end-review', payload)).data,
  end: async (payload: EndAssignments): Promise<{ placement_id: string; ended_count: number }> =>
    (await apiClient.post('/api/assignments/end', payload)).data,
}
