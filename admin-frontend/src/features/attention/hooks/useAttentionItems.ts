import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/shared/lib/api-client'
import type { AttentionResponse } from '../types'
export function useAttentionItems(userId: string) {
  return useQuery({ queryKey: ['attention-items', userId],
    queryFn: async ({ signal }): Promise<AttentionResponse> => (await apiClient.get('/api/attention-items', { signal })).data,
    enabled: !!userId, staleTime: 20_000, refetchInterval: 60_000, refetchOnWindowFocus: 'always' })
}
