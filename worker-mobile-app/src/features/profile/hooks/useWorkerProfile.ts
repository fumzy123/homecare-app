import { useQuery } from '@tanstack/react-query';
import { getMyProfile } from '../api';

export function useWorkerProfile() {
  return useQuery({
    queryKey: ['worker-profile'],
    queryFn: getMyProfile,
    staleTime: 1000 * 60 * 10,
  });
}
