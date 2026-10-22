import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMyNotifications } from '../api';
import { useAuthStore } from '@/shared/lib/auth-store';
import { notificationKey, notificationReadOptions } from '../lib/notificationRead';

export function useMyNotifications() {
  return useQuery({
    queryKey: notificationKey,
    queryFn: getMyNotifications,
    staleTime: 1000 * 30,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  const userId = useAuthStore(state => state.user?.id);
  return useMutation(notificationReadOptions(qc,
    () => !!userId && useAuthStore.getState().user?.id === userId));
}
