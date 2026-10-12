import { useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { billingApi } from '../api'

export function useBillingUsage(userId: string | undefined, timezone: string | null | undefined, subscriptionStatus: string | null) {
  return useQuery({
    queryKey: ['billing-usage', userId, timezone, subscriptionStatus],
    queryFn: billingApi.getCurrentUsage,
    enabled: Boolean(userId && timezone),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnMount: 'always',
    retry: (attempt, error) => !(isAxiosError(error) && [403, 409, 422].includes(error.response?.status ?? 0)) && attempt < 1,
  })
}
