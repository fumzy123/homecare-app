import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function usePushRefresh() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    for (const key of ['my-notifications', 'my-shifts', 'my-shift']) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  }, [queryClient]);
}
