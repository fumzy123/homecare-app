import { apiClient } from '@/shared/lib/api-client';
import type { WorkerShiftDetail } from '@/features/shifts/types';
import type { WorkerClient, WorkerClientProfile } from './types';

export async function getMyClients() {
  const { data } = await apiClient.get<WorkerClient[]>('/me/clients');
  return data;
}

export async function getMyClient(clientId: string) {
  const { data } = await apiClient.get<WorkerClientProfile>(`/me/clients/${clientId}`);
  return data;
}

export async function getMyClientVisits(clientId: string, fromDate: string, toDate: string) {
  const { data } = await apiClient.get<WorkerShiftDetail[]>(`/me/clients/${clientId}/shifts`, {
    params: { from_date: fromDate, to_date: toDate },
  });
  return data;
}
