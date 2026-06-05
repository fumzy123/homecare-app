import { apiClient } from '@/shared/lib/api-client'

export type NotificationType =
  | 'profile_updated'
  | 'credential_uploaded'
  | 'shift_dropped'
  | 'overtime_approval_requested'

export interface OvertimeNotificationPayload {
  requesting_member_id: string
  requesting_member_name: string
  week_start: string
  week_end: string
  total_hours: number
  // Present when request originated from CreateShiftDrawer
  client_id: string | null
  client_name: string | null
  start_time: string | null   // ISO datetime, naive
  end_time: string | null     // ISO datetime, naive
  is_recurring: boolean
  recurrence: {
    frequency: 'daily' | 'weekly'
    days_of_week?: string[]
    recurrence_end_date?: string
  } | null
  note: string | null
}

export interface Notification {
  id: string
  type: NotificationType
  worker_id: string
  worker_first_name: string
  worker_last_name: string
  payload: Record<string, unknown>
  requires_action: boolean
  resolved_at: string | null
  created_at: string
  read_at: string | null
}

export interface NotificationListResponse {
  notifications: Notification[]
  unread_count: number
  action_needed_count: number
}

export const notificationsApi = {
  list: async (): Promise<NotificationListResponse> => {
    const { data } = await apiClient.get('/api/notifications')
    return data
  },

  markRead: async (id: string): Promise<void> => {
    await apiClient.patch(`/api/notifications/${id}/read`)
  },

  markResolved: async (id: string): Promise<void> => {
    await apiClient.patch(`/api/notifications/${id}/resolve`)
  },
}
