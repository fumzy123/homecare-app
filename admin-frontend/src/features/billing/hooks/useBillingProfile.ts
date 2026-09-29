import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { billingApi } from '../api'

export function useBillingProfile(userId: string | undefined, enabled = true) {
  const client = useQueryClient()
  const refresh = async () => {
    await Promise.all(['billing-profile', 'billing-details', 'billing-status'].map(key => client.invalidateQueries({ queryKey: [key] })))
  }
  const profile = useQuery({ queryKey: ['billing-profile', userId], queryFn: billingApi.getProfile, enabled: Boolean(userId) && enabled })
  const update = useMutation({ mutationFn: billingApi.updateProfile, onSuccess: refresh })
  const setDefault = useMutation({ mutationFn: billingApi.setDefaultCard, onSuccess: refresh })
  const remove = useMutation({ mutationFn: billingApi.removeCard, onSuccess: refresh })
  const confirmSetup = useMutation({ mutationFn: billingApi.confirmPaymentSetup, onSuccess: refresh })
  return { profile, update, setDefault, remove, confirmSetup }
}

export function useCardSetup() {
  return useMutation({ mutationFn: billingApi.createSetupIntent })
}
