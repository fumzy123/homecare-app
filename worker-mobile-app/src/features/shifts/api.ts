import { apiClient } from '@/shared/lib/api-client';
import type { ShiftOccurrence, WorkerShiftDetail } from './types';

export async function getMyShifts(fromDate: string, toDate: string): Promise<ShiftOccurrence[]> {
  const { data } = await apiClient.get<ShiftOccurrence[]>('/me/shifts', {
    params: { from_date: fromDate, to_date: toDate },
  });
  return data;
}

export async function getMyShiftDetail(
  shiftId: string,
  occurrenceDate: string,
): Promise<WorkerShiftDetail> {
  const { data } = await apiClient.get<WorkerShiftDetail>(`/me/shifts/${shiftId}`, {
    params: { occurrence_date: occurrenceDate },
  });
  return data;
}
