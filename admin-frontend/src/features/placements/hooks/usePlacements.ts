import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { placementsApi } from '../api'
import type { PlacementCreatePayload, PlacementFillPayload, PlacementStatus } from '../api'

export function usePlacements(status?: PlacementStatus) {
  return useQuery({
    queryKey: ['placements', status ?? 'all'],
    queryFn: () => placementsApi.list(status),
  })
}

export function usePlacement(id: string) {
  return useQuery({
    queryKey: ['placements', id],
    queryFn: () => placementsApi.get(id),
    enabled: !!id,
  })
}

export function useCreatePlacement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: PlacementCreatePayload) => placementsApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['placements'] })
    },
  })
}

export function useFillPlacement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: PlacementFillPayload }) =>
      placementsApi.fill(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['placements'] })
    },
  })
}

export function useClosePlacement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => placementsApi.close(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['placements'] })
    },
  })
}
