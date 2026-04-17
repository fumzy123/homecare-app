import { apiClient } from '@/shared/lib/api-client'
import type { ScheduleMap } from '@/shared/components/AvailabilityGrid'

export type EmploymentType = 'full_time' | 'part_time' | 'casual'

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  casual: 'Casual',
}

export interface WorkerProfile {
  org_member_id: string
  street: string | null
  city: string | null
  province: string | null
  postal_code: string | null
  employment_type: EmploymentType | null
  has_vehicle: boolean | null
  max_hours_per_week: number | null
  availability: ScheduleMap | null
  created_at: string
  updated_at: string | null
}

export interface Worker {
  id: string
  first_name: string
  last_name: string
  email: string
  phone_number: string | null
  gender: string | null
  date_of_birth: string | null
  role: string
  hire_date: string | null
  is_active: boolean
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  emergency_contact_relationship: string | null
  org_id: string
  created_at: string
  updated_at: string | null
  worker_profile: WorkerProfile | null
}

export interface OrgMemberUpdatePayload {
  first_name?: string
  last_name?: string
  phone_number?: string
  gender?: string
  date_of_birth?: string
  hire_date?: string
  emergency_contact_name?: string
  emergency_contact_phone?: string
  emergency_contact_relationship?: string
}

export interface WorkerProfileUpdatePayload {
  street?: string
  city?: string
  province?: string
  postal_code?: string
  employment_type?: EmploymentType
  has_vehicle?: boolean
  max_hours_per_week?: number
  availability?: ScheduleMap
}

export const workersApi = {
  listWorkers: async (): Promise<Worker[]> => {
    const { data } = await apiClient.get('/api/workers/')
    return data
  },

  getWorker: async (workerId: string): Promise<Worker> => {
    const { data } = await apiClient.get(`/api/workers/${workerId}`)
    return data
  },

  updateWorker: async (workerId: string, payload: OrgMemberUpdatePayload): Promise<Worker> => {
    const { data } = await apiClient.patch(`/api/workers/${workerId}`, payload)
    return data
  },

  updateWorkerProfile: async (workerId: string, payload: WorkerProfileUpdatePayload): Promise<Worker> => {
    const { data } = await apiClient.patch(`/api/workers/${workerId}/profile`, payload)
    return data
  },

  deleteWorker: async (workerId: string): Promise<void> => {
    await apiClient.delete(`/api/workers/${workerId}`)
  },
}
