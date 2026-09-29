import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { billingApi } from '../api'

export function useBillingOnboarding(userId: string | undefined, owner: boolean) {
  const client = useQueryClient()
  const refresh = () => client.invalidateQueries({ queryKey: ['billing-status'] })
  const options = useQuery({ queryKey: ['billing-onboarding-options', userId], queryFn: billingApi.getOnboardingOptions, enabled: owner })
  const setup = useMutation({ mutationFn: billingApi.setupOnboardingCard, onSuccess: refresh })
  const confirm = useMutation({ mutationFn: billingApi.confirmOnboardingCard, onSuccess: result => {
    void refresh()
    if (result.url) window.location.assign(result.url)
  } })
  const cancel = useMutation({ mutationFn: billingApi.cancelOnboarding, onSuccess: refresh })
  const portal = useMutation({ mutationFn: billingApi.createPortalSession })
  const timezone = useMutation({ mutationFn: billingApi.setTimezone, onSuccess: refresh })
  return { options, setup, confirm, cancel, portal, timezone }
}

export function useBillingDetails(userId: string | undefined, enabled: boolean) {
  return useQuery({ queryKey: ['billing-details', userId], queryFn: billingApi.getBillingDetails, enabled, staleTime: 5 * 60 * 1000 })
}
