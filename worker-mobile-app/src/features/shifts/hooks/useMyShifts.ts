import { useQuery } from '@tanstack/react-query';
import { getMyShifts } from '../api';

// Formats a local Date as YYYY-MM-DD without UTC conversion.
function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function useMyShifts(fromDate: string, toDate: string) {
  return useQuery({
    queryKey: ['my-shifts', fromDate, toDate],
    queryFn: () => getMyShifts(fromDate, toDate),
  });
}

export function useTodayShifts() {
  const today = toDateString(new Date());
  return useQuery({
    queryKey: ['my-shifts', today, today],
    queryFn: () => getMyShifts(today, today),
    staleTime: 0,
  });
}
