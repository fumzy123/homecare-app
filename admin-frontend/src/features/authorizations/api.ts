import { apiClient } from '@/shared/lib/api-client'

export type ServiceType =
  | 'personal_care' | 'companionship' | 'respite' | 'nursing' | 'homemaking'
export type HoursPeriod = 'per_week' | 'bi_weekly' | 'per_month'
export type WeekDay = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU'
export type AuthorizationStatus =
  | 'pending' | 'active' | 'expired' | 'superseded' | 'cancelled'
export type AuthorizationCoverage = 'covered' | 'lapsed'
export type ComplianceStatus = 'within' | 'approaching' | 'exceeded'

export interface AuthorizationServiceLine {
  id: string
  service_type: ServiceType
  authorized_hours: number
}

export interface Authorization {
  id: string
  client_id: string
  funder: string
  funder_file_number: string | null
  authorization_number: string
  covering_start: string
  covering_end: string | null
  date_issued: string | null
  authorized_by: string | null
  hours_period: HoursPeriod
  client_monthly_contribution_amount: number | null
  invoice_to: string | null
  cancelled_at: string | null
  supersedes_id: string | null
  notes: string | null
  created_at: string | null
  status: AuthorizationStatus
  services: AuthorizationServiceLine[]
}

export interface AuthorizationServiceInput {
  service_type: ServiceType
  authorized_hours: number
}

export interface AuthorizationCreatePayload {
  funder: string
  funder_file_number?: string | null
  authorization_number: string
  covering_start: string
  covering_end?: string | null
  date_issued?: string | null
  authorized_by?: string | null
  hours_period: HoursPeriod
  client_monthly_contribution_amount?: number | null
  invoice_to?: string | null
  notes?: string | null
  supersedes_id?: string | null
  services: AuthorizationServiceInput[]
}

export interface ServiceCompliance {
  service_type: ServiceType
  authorized_biweekly: number
  planned_biweekly: number
  remaining: number
  status: ComplianceStatus
}

export interface AuthorizationCompliance {
  client_id: string
  coverage: AuthorizationCoverage
  services: ServiceCompliance[]
}

export const authorizationsApi = {
  list: async (clientId: string): Promise<Authorization[]> => {
    const { data } = await apiClient.get(`/api/clients/${clientId}/authorizations`)
    return data
  },

  create: async (clientId: string, payload: AuthorizationCreatePayload): Promise<Authorization> => {
    const { data } = await apiClient.post(`/api/clients/${clientId}/authorizations`, payload)
    return data
  },

  cancel: async (authorizationId: string): Promise<Authorization> => {
    const { data } = await apiClient.post(`/api/authorizations/${authorizationId}/cancel`, {})
    return data
  },

  compliance: async (clientId: string): Promise<AuthorizationCompliance> => {
    const { data } = await apiClient.get(`/api/clients/${clientId}/authorization-compliance`)
    return data
  },
}
