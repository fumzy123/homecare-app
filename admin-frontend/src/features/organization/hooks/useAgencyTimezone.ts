import { useMutation, useQueryClient } from '@tanstack/react-query'
import { billingApi } from '@/features/billing/api'

export function useUpdateAgencyTimezone() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: billingApi.setTimezone,
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['billing-status'] }),
        client.invalidateQueries({ queryKey: ['organization'] }),
      ])
    },
  })
}
