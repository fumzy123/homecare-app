import { apiClient } from '@/shared/lib/api-client'
import type { ServiceType, WeekDay } from '@/features/authorizations/api'

/** A single entry in a client's weekly care plan — one recurring block of care.
 *  For a funded client this is the "Authorized weekly care plan" (capped by the
 *  funder); for a self-pay client it is simply the weekly care plan. */
export interface WeeklyCarePlanEntry {
  id: string
  day_of_week: WeekDay
  start_time: string
  end_time: string
  service_type: ServiceType
}

export interface WeeklyCarePlanEntryInput {
  day_of_week: WeekDay
  start_time: string
  end_time: string
  service_type: ServiceType
}

export const weeklyCarePlanApi = {
  get: async (clientId: string): Promise<WeeklyCarePlanEntry[]> => {
    const { data } = await apiClient.get(`/api/clients/${clientId}/care-plan`)
    return data
  },

  put: async (clientId: string, entries: WeeklyCarePlanEntryInput[]): Promise<WeeklyCarePlanEntry[]> => {
    const { data } = await apiClient.put(`/api/clients/${clientId}/care-plan`, { entries })
    return data
  },
}
