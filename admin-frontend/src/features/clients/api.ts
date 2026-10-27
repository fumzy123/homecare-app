import { apiClient } from '@/shared/lib/api-client'
import type { NoteEntry } from '@/features/shifts/api'
import type { WeeklyCareNeed } from '@/features/weekly-care-need/api'

export type ClientStatus = 'active' | 'on_hold' | 'discharged'

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  active: 'Active',
  on_hold: 'On Hold',
  discharged: 'Discharged',
}

export interface DirectoryCareSummary {
  weekly_hours: number
  slot_count: number
  covered_slot_count: number | null
  state: 'current' | 'scheduled' | 'requested'
  starts_on: string | null
  revision_pending: boolean
  scheduled_change_on: string | null
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
  care_team: {
    id: string
    first_name: string
    last_name: string
    coverage: string[]
  }[]
  current_care_need?: WeeklyCareNeed | null
  directory_care?: DirectoryCareSummary | null
  medical_conditions: string | null
  allergies: string | null
  medications: string | null
  special_instructions: string | null
  emergency_contact_name: string
  emergency_contact_phone: string
  emergency_contact_relationship: string
  status: ClientStatus
  notes: string | null
  created_at: string
  updated_at: string | null
}

export interface ClientCreatePayload {
  first_name: string
  last_name: string
  date_of_birth: string
  gender?: string | null
  phone_number?: string | null
  email?: string | null
  street: string
  city: string
  province: string
  postal_code: string
  medical_conditions?: string | null
  allergies?: string | null
  medications?: string | null
  special_instructions?: string | null
  emergency_contact_name: string
  emergency_contact_phone: string
  emergency_contact_relationship: string
  status: ClientStatus
  notes?: string | null
}

export interface ClientNoteItem {
  shift_id: string
  worker_id: string
  occurrence_date: string
  worker_first_name: string
  worker_last_name: string
  entries: NoteEntry[]
  created_at: string | null
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

  updateClient: async (
    clientId: string,
    payload: Partial<ClientCreatePayload>,
  ): Promise<Client> => {
    const { data } = await apiClient.patch(`/api/clients/${clientId}`, payload)
    return data
  },

  deleteClient: async (clientId: string): Promise<void> => {
    await apiClient.delete(`/api/clients/${clientId}`)
  },

  getNotes: async (
    clientId: string,
    from?: string,
    to?: string,
  ): Promise<ClientNoteItem[]> => {
    const { data } = await apiClient.get(`/api/clients/${clientId}/notes`, {
      params: {
        ...(from ? { from_date: from } : {}),
        ...(to ? { to_date: to } : {}),
      },
    })
    return data
  },
}
