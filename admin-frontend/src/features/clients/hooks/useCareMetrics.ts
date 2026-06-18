import { useQuery } from '@tanstack/react-query'
import { shiftsApi } from '@/features/shifts/api'

/** Scheduled vs delivered care (with per-service breakdown) for a client over a
 *  date range. Delivered is provisional — derived from completed shifts. */
export function useClientCareMetrics(clientId: string, from: string, to: string) {
  return useQuery({
    queryKey: ['care-metrics', clientId, from, to],
    queryFn:  () => shiftsApi.getCareMetrics(from, to, undefined, clientId),
    enabled:  !!clientId && !!from && !!to,
  })
}
