import { apiClient } from '@/shared/lib/api-client';
import type { WorkerProfile, WorkerStats } from './types';

export async function getMyProfile(): Promise<WorkerProfile> {
  const { data } = await apiClient.get<WorkerProfile>('/me/profile');
  return data;
}

export async function getMyStats(): Promise<WorkerStats> {
  const { data } = await apiClient.get<WorkerStats>('/me/stats');
  return data;
}
