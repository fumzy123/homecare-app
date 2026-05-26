import { apiClient } from '@/shared/lib/api-client';
import type { ShiftOccurrence } from './types';

export async function getMyShifts(fromDate: string, toDate: string): Promise<ShiftOccurrence[]> {
  const { data } = await apiClient.get<ShiftOccurrence[]>('/me/shifts', {
    params: { from_date: fromDate, to_date: toDate },
  });
  return data;
}
