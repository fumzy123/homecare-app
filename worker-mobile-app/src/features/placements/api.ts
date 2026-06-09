import { apiClient } from '@/shared/lib/api-client';

export type PlacementStatus = 'open' | 'filled' | 'closed';

export interface WorkerPlacement {
  id: string;
  status: PlacementStatus;
  masked_location: string;
  shift_description: string;
  requirements: string | null;
  created_at: string;
  has_interest: boolean;
}

export async function getPlacementForWorker(placementId: string): Promise<WorkerPlacement> {
  const { data } = await apiClient.get<WorkerPlacement>(`/me/placements/${placementId}`);
  return data;
}

export async function expressInterest(placementId: string, note?: string): Promise<void> {
  await apiClient.post(`/placements/${placementId}/interest`, { note: note ?? null });
}

export async function withdrawInterest(placementId: string): Promise<void> {
  await apiClient.delete(`/placements/${placementId}/interest`);
}
