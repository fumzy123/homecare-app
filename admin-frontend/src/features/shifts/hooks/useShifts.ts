import { useQuery } from '@tanstack/react-query'
import { format, addDays, subDays, startOfWeek, endOfWeek } from 'date-fns'
import { WEEK_STARTS_ON } from '@/shared/lib/date'
import { shiftsApi } from '@/features/shifts/api'

export function useTodayShifts() {
  const today = format(new Date(), 'yyyy-MM-dd')
  return useQuery({
    queryKey: ['shifts', today, today],
    queryFn:  () => shiftsApi.listShifts(today, today),
  })
}

export function useWeekShifts() {
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: WEEK_STARTS_ON }), 'yyyy-MM-dd')
  const weekEnd   = format(endOfWeek(new Date(),   { weekStartsOn: WEEK_STARTS_ON }), 'yyyy-MM-dd')
  return useQuery({
    queryKey: ['shifts', weekStart, weekEnd],
    queryFn:  () => shiftsApi.listShifts(weekStart, weekEnd),
  })
}

export function useDroppedShifts() {
  const from = format(subDays(new Date(), 7),  'yyyy-MM-dd')
  const to   = format(addDays(new Date(), 60), 'yyyy-MM-dd')
  return useQuery({
    queryKey: ['shifts', from, to, 'dropped'],
    queryFn:  () => shiftsApi.listShifts(from, to, undefined, undefined, ['dropped']),
  })
}
