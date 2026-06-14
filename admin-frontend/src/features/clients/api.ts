import { apiClient } from '@/shared/lib/api-client'
import type { NoteEntry } from '@/features/shifts/api'

export type ClientStatus = 'active' | 'on_hold' | 'discharged'
export type ServiceType = 'personal_care' | 'companionship' | 'respite' | 'nursing' | 'homemaking'
export type AuthorizationCoverage = 'covered' | 'lapsed'

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
  homemaking: 'Homemaking',
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
  medical_conditions: string | null
  allergies: string | null
  medications: string | null
  special_instructions: string | null
  emergency_contact_name: string
  emergency_contact_phone: string
  emergency_contact_relationship: string
  status: ClientStatus
  notes: string | null
  // Derived from authorizations (not stored on the client)
  service_types: ServiceType[]
  care_start: string | null
  care_end: string | null
  coverage: AuthorizationCoverage
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
  medical_conditions?: string
  allergies?: string
  medications?: string
  special_instructions?: string
  emergency_contact_name: string
  emergency_contact_phone: string
  emergency_contact_relationship: string
  status: ClientStatus
  notes?: string
}

export interface ClientNoteItem {
  shift_id: string
  occurrence_date: string
  worker_first_name: string
  worker_last_name: string
  entries: NoteEntry[]
  created_at: string
  updated_at: string | null
}

export const clientsApi = {
  listClients: async (status?: ClientStatus): Promise<Client[]> => {
    const { data } = await apiClient.get('/api/clients', {
      params: status ? { status } : undefined,
    })
    return data
  },

  createClient: async (payload: ClientCreatePayload): Promise<Client> => {
    const { data } = await apiClient.post('/api/clients', payload)
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

  getNotes: async (clientId: string, year?: number): Promise<ClientNoteItem[]> => {
    const { data } = await apiClient.get(`/api/clients/${clientId}/notes`, {
      params: year ? { year } : undefined,
    })
    return data
  },
}
