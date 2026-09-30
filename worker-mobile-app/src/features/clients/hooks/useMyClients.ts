import { useQuery } from '@tanstack/react-query';
import { getMyClient, getMyClients, getMyClientVisits } from '../api';

export function useMyClients() {
  return useQuery({ queryKey: ['my-clients'], queryFn: getMyClients });
}

export function useMyClient(clientId: string) {
  return useQuery({
    queryKey: ['my-client', clientId], queryFn: () => getMyClient(clientId), enabled: Boolean(clientId),
  });
}

export function useMyClientVisits(clientId: string, fromDate: string, toDate: string) {
  return useQuery({
    queryKey: ['my-client-visits', clientId, fromDate, toDate],
    queryFn: () => getMyClientVisits(clientId, fromDate, toDate), enabled: Boolean(clientId),
  });
}
