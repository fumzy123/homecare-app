import { apiClient } from '@/shared/lib/api-client'

export type EmploymentType = 'full_time' | 'part_time'
export type WeekDay = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU'

export interface AvailabilityEntry {
  id: string
  day_of_week: WeekDay
  start_time: string  // "HH:MM" or "HH:MM:SS"
  end_time: string
}

export interface AvailabilityEntryInput {
  day_of_week: WeekDay
  start_time: string  // "HH:MM"
  end_time: string
}

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
}

export interface OrgMember {
  id: string
  first_name: string
  last_name: string
  email: string
  role: string
  phone_number: string | null
  gender: string | null
  date_of_birth: string | null
  hire_date: string | null
  is_active: boolean
  employment_type: EmploymentType | null
  has_vehicle: boolean | null
  max_hours_per_week: number | null
  street: string | null
  city: string | null
  province: string | null
  postal_code: string | null
  availability: AvailabilityEntry[]
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  emergency_contact_relationship: string | null
  org_id: string
  created_at: string
  updated_at: string | null
}

export interface OrgMemberUpdatePayload {
  first_name?: string
  last_name?: string
  phone_number?: string
  gender?: string
  date_of_birth?: string
  hire_date?: string
  is_active?: boolean
  employment_type?: EmploymentType
  has_vehicle?: boolean
  max_hours_per_week?: number
  street?: string
  city?: string
  province?: string
  postal_code?: string
  emergency_contact_name?: string
  emergency_contact_phone?: string
  emergency_contact_relationship?: string
}

export interface OrgMemberSelfUpdatePayload {
  first_name?: string
  last_name?: string
  email?: string
  phone_number?: string
  gender?: string
  date_of_birth?: string
}

export interface WorkerCredential {
  id: string
  org_member_id: string
  document_type: string
  expiry_date: string | null
  file_url: string | null
  uploaded_at: string | null
  verified_at: string | null
  verified_by: string | null
}

export interface ExpiringCredential {
  id: string
  document_type: string
  expiry_date: string
  days_remaining: number
  worker_id: string
  worker_first_name: string
  worker_last_name: string
}

export const orgMembersApi = {
  listByRole: async (role: OrgMember['role']): Promise<OrgMember[]> => {
    const { data } = await apiClient.get(`/api/org-members?role=${role}`)
    return data
  },

  getOrgMember: async (memberId: string): Promise<OrgMember> => {
    const { data } = await apiClient.get(`/api/org-members/${memberId}`)
    return data
  },

  updateOrgMember: async (memberId: string, payload: OrgMemberUpdatePayload): Promise<OrgMember> => {
    const { data } = await apiClient.patch(`/api/org-members/${memberId}`, payload)
    return data
  },

  updateSelf: async (memberId: string, payload: OrgMemberSelfUpdatePayload): Promise<OrgMember> => {
    const { data } = await apiClient.patch(`/api/org-members/${memberId}/self`, payload)
    return data
  },

  deleteOrgMember: async (memberId: string): Promise<void> => {
    await apiClient.delete(`/api/org-members/${memberId}`)
  },

  getAvailability: async (memberId: string): Promise<AvailabilityEntry[]> => {
    const { data } = await apiClient.get(`/api/org-members/${memberId}/availability`)
    return data
  },

  putAvailability: async (memberId: string, entries: AvailabilityEntryInput[]): Promise<AvailabilityEntry[]> => {
    const { data } = await apiClient.put(`/api/org-members/${memberId}/availability`, { entries })
    return data
  },

  // Employment ids whose recurring availability covers the given block.
  getAvailableMembers: async (day: WeekDay, start: string, end: string): Promise<string[]> => {
    const { data } = await apiClient.get('/api/org-members/available', {
      params: { day, start, end },
    })
    return data
  },

  listCredentials: async (memberId: string): Promise<WorkerCredential[]> => {
    const { data } = await apiClient.get(`/api/org-members/${memberId}/credentials`)
    return data
  },

  verifyCredential: async (
    memberId: string,
    documentType: string,
    expiryDate: string,
  ): Promise<WorkerCredential> => {
    const { data } = await apiClient.patch(
      `/api/org-members/${memberId}/credentials/${documentType}/verify`,
      { expiry_date: expiryDate },
    )
    return data
  },

  getCredentialPreviewUrl: async (memberId: string, documentType: string): Promise<string> => {
    const { data } = await apiClient.get(
      `/api/org-members/${memberId}/credentials/${documentType}/preview-url`,
    )
    return data.url
  },

  listExpiringCredentials: async (withinDays = 30): Promise<ExpiringCredential[]> => {
    const { data } = await apiClient.get(`/api/credentials/expiring?within_days=${withinDays}`)
    return data
  },

  uploadCredentialDocument: async (memberId: string, documentType: string, file: File): Promise<WorkerCredential> => {
    const formData = new FormData()
    formData.append('file', file)
    const { data } = await apiClient.post(
      `/api/org-members/${memberId}/credentials/${documentType}/upload`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )
    return data
  },
}
