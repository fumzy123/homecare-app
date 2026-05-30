import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from './api'

const QUERY_KEY = ['notifications']

export function useNotifications() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: notificationsApi.list,
    refetchInterval: 30_000,  // poll every 30 s
    staleTime: 20_000,
  })
}

export function useMarkRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useMarkResolved() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: notificationsApi.markResolved,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}
