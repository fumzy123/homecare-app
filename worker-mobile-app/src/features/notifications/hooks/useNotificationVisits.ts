import { useQueries } from '@tanstack/react-query';
import type { WorkerNotification } from '../api';
import { notificationDestination } from '../lib/notificationDestination';
import { getMyShiftDetail } from '@/features/shifts/api';

export function useNotificationVisits(notifications: WorkerNotification[]) {
  const targets = new Map<string, { shiftId: string; occurrenceDate: string }>();
  for (const notification of notifications) {
    const target = notificationDestination(notification);
    if (target?.pathname === '/shifts/[shiftId]') {
      targets.set(`${target.params.shiftId}:${target.params.occurrenceDate}`, target.params);
    }
  }
  const entries = [...targets.entries()];
  const queries = useQueries({ queries: entries.map(([, target]) => ({
    queryKey: ['my-shift', target.shiftId, target.occurrenceDate],
    queryFn: () => getMyShiftDetail(target.shiftId, target.occurrenceDate),
    staleTime: 30000,
    retry: false,
  })) });
  return new Map(entries.map(([key], index) => [key, queries[index]]));
}
