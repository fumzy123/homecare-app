import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMyNotifications, markNotificationRead } from '../api';

export function useMyNotifications() {
  return useQuery({
    queryKey: ['my-notifications'],
    queryFn: getMyNotifications,
    staleTime: 1000 * 30,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-notifications'] });
    },
  });
}
