import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { reviewApi } from '../review-api'

export function useBillingReviews(userId: string | undefined, period: string) {
  const cache = useQueryClient()
  const key = ['billing-reviews', userId, period]
  const reviews = useQuery({ queryKey: key, queryFn: () => reviewApi.list(period), enabled: Boolean(userId), refetchInterval: 60_000 })
  const submit = useMutation({ mutationFn: (payload: { request_id: string; message: string }) => reviewApi.submit(period, payload),
    onSuccess: () => cache.invalidateQueries({ queryKey: key }) })
  return { reviews, submit }
}

export function useBillingReviewQueue(userId: string | undefined) {
  const cache = useQueryClient()
  const key = ['billing-review-queue', userId]
  const queue = useQuery({ queryKey: key, queryFn: reviewApi.queue, enabled: Boolean(userId), refetchInterval: 60_000 })
  const resolve = useMutation({ mutationFn: ({ id, response }: { id: string; response: string }) => reviewApi.resolve(id, response),
    onSuccess: () => cache.invalidateQueries({ queryKey: key }) })
  return { queue, resolve }
}
