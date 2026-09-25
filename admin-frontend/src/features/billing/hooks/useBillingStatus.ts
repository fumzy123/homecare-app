import { useQuery } from '@tanstack/react-query'
import { billingApi } from '../api'

export function useBillingStatus(userId?: string) {
  return useQuery({ queryKey: ['billing-status', userId], queryFn: billingApi.getStatus, staleTime: 5 * 60 * 1000 })
}
