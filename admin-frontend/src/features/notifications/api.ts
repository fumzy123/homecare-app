import { apiClient } from '@/shared/lib/api-client'

export type NotificationType =
  | 'profile_updated'
  | 'credential_uploaded'
  | 'shift_dropped'

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
