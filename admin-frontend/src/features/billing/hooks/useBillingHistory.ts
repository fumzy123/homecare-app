import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { billingApi } from '../api'

export function useInvoiceHistory(userId: string | undefined) {
  return useInfiniteQuery({
    queryKey: ['billing-invoices', userId], enabled: Boolean(userId),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => billingApi.getInvoiceHistory(pageParam),
    getNextPageParam: page => page.next_cursor ?? undefined,
    staleTime: 60_000,
  })
}

export function useUsageHistory(userId: string | undefined) {
  return useInfiniteQuery({
    queryKey: ['billing-history', userId], enabled: Boolean(userId),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => billingApi.getUsageHistory(pageParam),
    getNextPageParam: page => page.next_cursor ?? undefined,
    staleTime: 60_000,
  })
}

export function usePeriodHistory(userId: string | undefined, periodId: string) {
  const corrections = useQuery({
    queryKey: ['billing-corrections', userId, periodId], enabled: Boolean(userId),
    queryFn: () => billingApi.getCorrections(periodId), staleTime: 60_000,
  })
  const settlements = useQuery({
    queryKey: ['billing-settlements', userId, periodId], enabled: Boolean(userId),
    queryFn: () => billingApi.getSettlements(periodId), staleTime: 60_000,
  })
  return { corrections, settlements }
}
