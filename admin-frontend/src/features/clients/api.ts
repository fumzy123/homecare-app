import { apiClient } from '@/shared/lib/api-client'
import type { ScheduleMap } from '@/shared/components/AvailabilityGrid'

export type ClientStatus = 'active' | 'on_hold' | 'discharged'
export type ServiceType = 'personal_care' | 'companionship' | 'respite' | 'nursing'

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  active: 'Active',
  on_hold: 'On Hold',
  discharged: 'Discharged',
}

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  personal_care: 'Personal Care',
  companionship: 'Companionship',
  respite: 'Respite',
  nursing: 'Nursing',
}

export interface Client {
  id: string
  first_name: string
  last_name: string
  date_of_birth: string
  gender: string | null
  phone_number: string | null
  email: string | null
  street: string
  city: string
  province: string
  postal_code: string
  org_id: string
  assigned_worker_id: string | null
  assigned_worker: { id: string; first_name: string; last_name: string } | null
  service_type: ServiceType
  medical_conditions: string | null
  allergies: string | null
  medications: string | null
  special_instructions: string | null
  emergency_contact_name: string
  emergency_contact_phone: string
  emergency_contact_relationship: string
  status: ClientStatus
  care_start_date: string
  care_end_date: string | null
  funding_source: string | null
  notes: string | null
  requested_schedule: ScheduleMap | null
  created_at: string
  updated_at: string | null
}

export interface ClientCreatePayload {
  first_name: string
  last_name: string
  date_of_birth: string
  gender?: string
  phone_number?: string
  email?: string
  street: string
  city: string
  province: string
  postal_code: string
  service_type: ServiceType
  medical_conditions?: string
  allergies?: string
  medications?: string
  special_instructions?: string
  emergency_contact_name: string
  emergency_contact_phone: string
  emergency_contact_relationship: string
  status: ClientStatus
  care_start_date: string
  care_end_date?: string
  funding_source?: string
  notes?: string
  requested_schedule?: ScheduleMap
}

export const clientsApi = {
  listClients: async (status?: ClientStatus): Promise<Client[]> => {
    const { data } = await apiClient.get('/api/clients/', {
      params: status ? { status } : undefined,
    })
    return data
  },

  createClient: async (payload: ClientCreatePayload): Promise<Client> => {
    const { data } = await apiClient.post('/api/clients/', payload)
    return data
  },

  getClient: async (clientId: string): Promise<Client> => {
    const { data } = await apiClient.get(`/api/clients/${clientId}`)
    return data
  },

  updateClient: async (clientId: string, payload: Partial<ClientCreatePayload>): Promise<Client> => {
    const { data } = await apiClient.patch(`/api/clients/${clientId}`, payload)
    return data
  },

  deleteClient: async (clientId: string): Promise<void> => {
    await apiClient.delete(`/api/clients/${clientId}`)
  },
}
