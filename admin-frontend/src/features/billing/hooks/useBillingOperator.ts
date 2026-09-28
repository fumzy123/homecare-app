import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { operatorApi, type OperatorAction } from '../operator-api'
import { authApi } from '@/features/auth/api'
import { useAuthStore } from '@/shared/stores/auth'

export function useOperatorSignOut() {
  const client = useQueryClient()
  return useMutation({ mutationFn: authApi.signOut, onSuccess: () => {
    client.clear()
    useAuthStore.getState().clearAuth()
    window.location.assign('/login')
  } })
}

export function useOperatorAccess(userId?: string) {
  return useQuery({ queryKey: ['billing-operator', userId, 'access'], queryFn: operatorApi.access,
    enabled: Boolean(userId), retry: false, staleTime: 30_000 })
}
export function useOperatorAgencies(userId: string | undefined, search: string) {
  return useInfiniteQuery({ queryKey: ['billing-operator', userId, 'agencies', search],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => operatorApi.agencies(search, pageParam), getNextPageParam: page => page.next_cursor ?? undefined })
}
export function useOperatorAgency(userId: string | undefined, org: string) {
  const client = useQueryClient()
  const refresh = () => client.invalidateQueries({ queryKey: ['billing-operator', userId] })
  const details = useQuery({ queryKey: ['billing-operator', userId, org], queryFn: () => operatorApi.agency(org) })
  const periods = useInfiniteQuery({ queryKey: ['billing-operator', userId, org, 'periods'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => operatorApi.periods(org, pageParam), getNextPageParam: page => page.next_cursor ?? undefined })
  const action = useMutation({ mutationFn: (action: OperatorAction) => operatorApi.action(org, action), onSettled: refresh })
  return { details, periods, action }
}
export function useOperatorPeriod(userId: string | undefined, org: string, period: string) {
  const client = useQueryClient()
  const refresh = () => client.invalidateQueries({ queryKey: ['billing-operator', userId] })
  const corrections = useQuery({ queryKey: ['billing-operator', userId, org, period, 'corrections'], queryFn: () => operatorApi.corrections(org, period) })
  const settlements = useQuery({ queryKey: ['billing-operator', userId, org, period, 'settlements'], queryFn: () => operatorApi.settlements(org, period) })
  const propose = useMutation({ mutationFn: (body: { request_id: string; reason: string }) => operatorApi.propose(org, period, body), onSettled: refresh })
  const decide = useMutation({ mutationFn: (body: { id: string; decision: 'approved' | 'rejected'; reason: string }) => operatorApi.decide(org, period, body), onSettled: refresh })
  return { corrections, settlements, propose, decide }
}
