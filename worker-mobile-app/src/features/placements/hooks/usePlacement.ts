import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPlacementForWorker, expressInterest, withdrawInterest } from '../api';

export function usePlacement(placementId: string) {
  return useQuery({
    queryKey: ['placement', placementId],
    queryFn: () => getPlacementForWorker(placementId),
    enabled: !!placementId,
  });
}

export function useExpressInterest(placementId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (note?: string) => expressInterest(placementId, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['placement', placementId] });
    },
  });
}

export function useWithdrawInterest(placementId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => withdrawInterest(placementId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['placement', placementId] });
    },
  });
}
