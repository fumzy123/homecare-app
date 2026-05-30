import { apiClient } from '@/shared/lib/api-client';
import type { WorkerProfile, WorkerProfileUpdatePayload, WorkerStats, Credential } from './types';

export async function getMyProfile(): Promise<WorkerProfile> {
  const { data } = await apiClient.get<WorkerProfile>('/me/profile');
  return data;
}

export async function getMyStats(): Promise<WorkerStats> {
  const { data } = await apiClient.get<WorkerStats>('/me/stats');
  return data;
}

export async function getMyCredentials(): Promise<Credential[]> {
  const { data } = await apiClient.get<Credential[]>('/me/credentials');
  return data;
}

export async function updateMyProfile(payload: WorkerProfileUpdatePayload): Promise<WorkerProfile> {
  const { data } = await apiClient.patch<WorkerProfile>('/me/profile', payload);
  return data;
}
