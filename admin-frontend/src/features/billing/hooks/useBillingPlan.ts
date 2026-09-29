import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { billingApi } from '../api'

export function useBillingPlan(userId: string | undefined) {
  const client = useQueryClient()
  const cancel = useMutation({ mutationFn: billingApi.cancelPlanChange, onSuccess: () => client.invalidateQueries({ queryKey: ['billing-plan-pending'] }) })
  const preview = useMutation({ mutationFn: billingApi.previewPlan })
  const change = useMutation({ mutationFn: billingApi.changePlan, onSuccess: async () => {
    await Promise.all(['billing-status', 'billing-plan-pending'].map(key => client.invalidateQueries({ queryKey: [key] })))
  } })
  const pending = useQuery({ queryKey: ['billing-plan-pending', userId], queryFn: billingApi.pendingPlan, enabled: Boolean(userId) })
  return { preview, change, pending, cancel }
}
