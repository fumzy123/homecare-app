import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/shared/lib/api-client'
export interface CareAction { client_id: string; client_name: string; weekly_care_need_id: string; placement_id: string | null; effective_from: string; overdue: boolean; uncovered_count: number; pending_interest_count: number; action: string }
export function useCareActions() {
  return useQuery({ queryKey: ['care-actions'], queryFn: async (): Promise<CareAction[]> => (await apiClient.get('/api/care-actions')).data, refetchInterval: 60_000 })
}
