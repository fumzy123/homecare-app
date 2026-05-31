import { apiClient } from '@/shared/lib/api-client'
import type { ScheduleMap } from '@/shared/components/AvailabilityGrid'

export type EmploymentType = 'full_time' | 'part_time' | 'casual'

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  casual:    'Casual',
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
  max_hours_per_week: number
  street: string | null
  city: string | null
  province: string | null
  postal_code: string | null
  availability: ScheduleMap | null
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
  availability?: ScheduleMap
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
}
