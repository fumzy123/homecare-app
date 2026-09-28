import { useQuery } from '@tanstack/react-query'
import { shiftsApi } from '../api'
import { useAuthStore } from '@/shared/stores/auth'

const TIMESHEET_STATUSES = ['completed', 'no_show', 'cancelled']

export function timesheetQueryOptions(userId: string | undefined, from: string, to: string, workerId: string, clientId: string) {
  const queryFrom = from || '2020-01-01'
  const queryTo = to || '2030-12-31'
  return {
    queryKey: ['shifts', 'timesheet', userId, queryFrom, queryTo, workerId, clientId],
    queryFn: () => shiftsApi.listShifts(queryFrom, queryTo, workerId || undefined, clientId || undefined, TIMESHEET_STATUSES),
    enabled: Boolean(userId),
  }
}

export function useTimesheetShifts(from: string, to: string, workerId: string, clientId: string) {
  const userId = useAuthStore(s => s.user?.id)
  return useQuery(timesheetQueryOptions(userId, from, to, workerId, clientId))
}
