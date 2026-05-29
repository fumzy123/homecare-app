import { useQuery } from '@tanstack/react-query';
import { getMyCredentials } from '../api';

export function useMyCredentials() {
  return useQuery({
    queryKey: ['my-credentials'],
    queryFn: getMyCredentials,
    staleTime: 1000 * 60 * 10,
  });
}
