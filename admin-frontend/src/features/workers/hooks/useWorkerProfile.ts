import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useBillingStatus } from '@/features/billing/hooks/useBillingStatus'
import { useAuthStore } from '@/shared/stores/auth'
import { shiftsApi } from '@/features/shifts/api'
import { leaveApi, type LeaveRecordCreatePayload } from '@/features/leave/api'
import {
  orgMembersApi,
  type OrgMemberUpdatePayload,
} from '@/features/org-members/api'
import { agencyClock } from '../lib/profile'

export function useWorkerClock() {
  const userId = useAuthStore((s) => s.user?.id)
  const query = useBillingStatus(userId)
  const [instant, setInstant] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setInstant(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])
  const timezone = query.data?.billing_timezone
  return {
    query,
    timezone,
    ...(timezone ? agencyClock(timezone, instant) : { today: '', now: '' }),
  }
}

export function useWorkerVisits(workerId: string, from: string, to: string) {
  return useQuery({
    queryKey: [
      'shifts',
      'calendar',
      from,
      to,
      workerId,
      undefined,
      'effective-window',
    ],
    queryFn: () =>
      shiftsApi.listShifts(
        from,
        to,
        workerId,
        undefined,
        [
          'scheduled',
          'in_progress',
          'completed',
          'cancelled',
          'no_show',
          'dropped',
        ],
        true,
      ),
    enabled: Boolean(workerId && from && to),
    refetchInterval: 60_000,
  })
}
export function useWorkerLeave(workerId: string, year: number) {
  return useQuery({
    queryKey: ['leave', workerId, year],
    queryFn: () => leaveApi.list(workerId, year),
  })
}
export function useWorkerLeaveMutations(workerId: string) {
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ queryKey: ['leave', workerId] })
  const create = useMutation({
    mutationFn: (payload: LeaveRecordCreatePayload) =>
      leaveApi.create(workerId, payload),
    onSuccess: refresh,
    retry: false,
    networkMode: 'always',
  })
  const remove = useMutation({
    mutationFn: (id: string) => leaveApi.delete(workerId, id),
    onSuccess: refresh,
    retry: false,
    networkMode: 'always',
  })
  return { create, remove }
}
export function useUpdateWorker(workerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: OrgMemberUpdatePayload) =>
      orgMembersApi.updateOrgMember(workerId, payload),
    onSuccess: async () => {
      await Promise.all(
        ['worker', 'workers', 'shifts'].map((key) =>
          qc.invalidateQueries({
            queryKey: key === 'worker' ? [key, workerId] : [key],
          }),
        ),
      )
    },
    retry: false,
    networkMode: 'always',
  })
}
export function useDeleteWorker(workerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => orgMembersApi.deleteOrgMember(workerId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workers'] }),
    retry: false,
    networkMode: 'always',
  })
}
