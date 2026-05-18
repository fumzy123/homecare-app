import { apiClient } from '@/shared/lib/api-client'

export type LeaveType = 'sick' | 'vacation' | 'bereavement' | 'other'

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  sick:        'Sick Day',
  vacation:    'Vacation',
  bereavement: 'Bereavement',
  other:       'Other',
}

export interface LeaveRecord {
  id: string
  worker_id: string
  org_id: string
  leave_type: LeaveType
  start_date: string
  end_date: string
  notes: string | null
  recorded_by: string
  created_at: string
}

export interface LeaveRecordCreatePayload {
  leave_type: LeaveType
  start_date: string
  end_date: string
  notes?: string
}

export const leaveApi = {
  list: (workerId: string, year: number): Promise<LeaveRecord[]> =>
    apiClient.get(`/api/org-members/${workerId}/leave`, { params: { year } }).then((r) => r.data),

  create: (workerId: string, payload: LeaveRecordCreatePayload): Promise<LeaveRecord> =>
    apiClient.post(`/api/org-members/${workerId}/leave`, payload).then((r) => r.data),

  delete: (workerId: string, leaveId: string): Promise<void> =>
    apiClient.delete(`/api/org-members/${workerId}/leave/${leaveId}`).then(() => undefined),
}

export function countDays(record: LeaveRecord): number {
  const start = new Date(record.start_date)
  const end   = new Date(record.end_date)
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
}

export function buildStats(records: LeaveRecord[]): Record<LeaveType, number> {
  const counts: Record<LeaveType, number> = { sick: 0, vacation: 0, bereavement: 0, other: 0 }
  for (const r of records) counts[r.leave_type] += countDays(r)
  return counts
}
