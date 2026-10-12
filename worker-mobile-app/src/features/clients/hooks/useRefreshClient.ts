import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRefreshControl } from '@/shared/hooks/useRefreshControl';

export function useRefreshClient(clientId: string) {
  const queryClient = useQueryClient();
  const refetch = useCallback(() => Promise.all([
    queryClient.refetchQueries({ queryKey: ['my-client', clientId], type: 'active' }),
    queryClient.refetchQueries({ queryKey: ['my-client-visits', clientId], type: 'active' }),
    queryClient.refetchQueries({ queryKey: ['recorded-notes'], type: 'active' }),
  ]), [clientId, queryClient]);
  return useRefreshControl(refetch);
}
