import { useQuery } from '@tanstack/react-query';
import { getMyStats } from '../api';

export function useWorkerStats() {
  return useQuery({
    queryKey: ['worker-stats'],
    queryFn: getMyStats,
    staleTime: 1000 * 60 * 5,
  });
}
