import { useMutation, useQueryClient } from '@tanstack/react-query'
import { billingApi } from '../api'

export function useEmbeddedBilling() {
  const client = useQueryClient()
  const refresh = () => client.invalidateQueries({ queryKey: ['billing-status'] })
  const setup = useMutation({ mutationFn: billingApi.embeddedSetup })
  const confirm = useMutation({ mutationFn: billingApi.embeddedConfirm, onSuccess: refresh })
  return { setup, confirm }
}
