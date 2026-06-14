import { useQuery } from '@tanstack/react-query'
import { format, addDays } from 'date-fns'
import { shiftsApi } from '@/features/shifts/api'
import { getDateRange, type Period } from '@/features/shifts/utils/period'

export function useClientShiftStats(clientId: string, period: Period) {
  const { from, to } = getDateRange(period)
  return useQuery({
    queryKey: ['shift-stats', from, to, '', clientId],
    queryFn:  () => shiftsApi.getShiftStats(from, to, undefined, clientId),
    enabled:  !!clientId,
  })
}

export function useClientShifts(clientId: string, period: Period) {
  const { from, to } = getDateRange(period)
  return useQuery({
    queryKey: ['shifts', from, to, '', clientId],
    queryFn:  () => shiftsApi.listShifts(from, to, undefined, clientId),
    enabled:  !!clientId,
  })
}

/** Scheduled visits from today forward (default: next 21 days), ascending. */
export function useUpcomingVisits(clientId: string, days = 21) {
  const from = format(new Date(), 'yyyy-MM-dd')
  const to   = format(addDays(new Date(), days), 'yyyy-MM-dd')
  return useQuery({
    queryKey: ['shifts', 'upcoming', from, to, clientId],
    queryFn:  () => shiftsApi.listShifts(from, to, undefined, clientId, ['scheduled', 'in_progress']),
    enabled:  !!clientId,
    select:   (shifts) =>
      shifts
        .slice()
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()),
  })
}
