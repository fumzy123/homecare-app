import type { QueryClient } from '@tanstack/react-query';
import { markNotificationRead, type NotificationListResponse } from '../api';

export const notificationKey = ['my-notifications'] as const;
const readKey = ['notification-read'] as const;

function setRead(data: NotificationListResponse | undefined, id: string, readAt: string | null) {
  if (!data) return data;
  const previous = data.notifications.find(n => n.id === id);
  if (!previous || previous.read_at === readAt) return data;
  const delta = previous.read_at === null && readAt !== null ? -1
    : previous.read_at !== null && readAt === null ? 1 : 0;
  return { ...data, unread_count: Math.max(0, data.unread_count + delta),
    notifications: data.notifications.map(n => n.id === id ? { ...n, read_at: readAt } : n) };
}

export function notificationReadOptions(qc: QueryClient, isCurrentUser: () => boolean) {
  return {
    mutationKey: readKey,
    mutationFn: async (id: string) => {
      if (!isCurrentUser()) throw new Error('Account changed');
      await markNotificationRead(id);
    },
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: notificationKey });
      if (!isCurrentUser()) throw new Error('Account changed');
      const previous = qc.getQueryData<NotificationListResponse>(notificationKey)?.notifications.find(n => n.id === id);
      const timestamp = new Date().toISOString();
      if (previous?.read_at === null) {
        qc.setQueryData<NotificationListResponse>(notificationKey, data => setRead(data, id, timestamp));
      }
      return { wasUnread: previous?.read_at === null, timestamp };
    },
    onSuccess: (_: void, id: string) => {
      if (!isCurrentUser()) return;
      qc.setQueryData<NotificationListResponse>(notificationKey, data => setRead(data, id, new Date().toISOString()));
    },
    onError: (_: unknown, id: string, context: { wasUnread: boolean; timestamp: string } | undefined) => {
      if (!isCurrentUser() || !context?.wasUnread) return;
      qc.setQueryData<NotificationListResponse>(notificationKey, data => {
        // Undo only this failed write; never undo another notification's success.
        return data?.notifications.find(n => n.id === id)?.read_at === context.timestamp
          ? setRead(data, id, null) : data;
      });
    },
    onSettled: () => {
      if (isCurrentUser() && qc.isMutating({ mutationKey: readKey }) === 1) {
        void qc.invalidateQueries({ queryKey: notificationKey });
      }
    },
  };
}
