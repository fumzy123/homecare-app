import { useQuery } from '@tanstack/react-query'
import { billingApi } from '../api'

export function useUpcomingBilling(userId: string | undefined) {
  return useQuery({ queryKey: ['billing-upcoming', userId], queryFn: billingApi.getUpcoming,
    enabled: Boolean(userId), staleTime: 30_000, refetchInterval: 60_000 })
}
