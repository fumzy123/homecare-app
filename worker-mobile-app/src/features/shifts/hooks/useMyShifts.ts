import { useQuery } from '@tanstack/react-query';
import { getMyShiftDetail, getMyShifts } from '../api';
import { toDateKey } from '../lib/schedule';

export function useMyShifts(fromDate: string, toDate: string) {
  return useQuery({
    queryKey: ['my-shifts', fromDate, toDate],
    queryFn: () => getMyShifts(fromDate, toDate),
  });
}

export function useTodayShifts() {
  const today = toDateKey(new Date());
  return useQuery({
    queryKey: ['my-shifts', today, today],
    queryFn: () => getMyShifts(today, today),
    staleTime: 0,
  });
}

export function useMyShiftDetail(shiftId: string, occurrenceDate: string) {
  return useQuery({
    queryKey: ['my-shift', shiftId, occurrenceDate],
    queryFn: () => getMyShiftDetail(shiftId, occurrenceDate),
    enabled: Boolean(shiftId && occurrenceDate),
  });
}
