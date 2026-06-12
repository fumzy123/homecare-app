import { apiClient } from '@/shared/lib/api-client';

export type NotificationType =
  | 'profile_updated'
  | 'credential_uploaded'
  | 'shift_dropped'
  | 'overtime_approval_requested'
  | 'placement_created'
  | 'placement_filled'
  | 'placement_closed';

export interface WorkerNotification {
  id: string;
  type: NotificationType;
  target_audience: string;
  about_worker_id: string | null;
  about_client_id: string | null;
  triggered_by_id: string | null;
  payload: Record<string, unknown>;
  requires_action: boolean;
  resolved_at: string | null;
  created_at: string;
  read_at: string | null;
}

export interface NotificationListResponse {
  notifications: WorkerNotification[];
  unread_count: number;
  action_needed_count: number;
}

export async function getMyNotifications(): Promise<NotificationListResponse> {
  const { data } = await apiClient.get<NotificationListResponse>('/me/notifications');
  return data;
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiClient.patch(`/me/notifications/${id}/read`);
}
