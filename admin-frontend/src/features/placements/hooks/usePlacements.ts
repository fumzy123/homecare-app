import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { placementsApi } from '../api'
import type { ApprovalPayload, PlacementCreatePayload, PlacementFillPayload, PlacementStatus } from '../api'

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
      qc.invalidateQueries({ queryKey: ['placements'] }); qc.invalidateQueries({ queryKey: ['care-actions'] })
    },
  })
}

export function useFillPlacement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: PlacementFillPayload }) =>
      placementsApi.fill(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['placements'] }); qc.invalidateQueries({ queryKey: ['care-actions'] })
      qc.invalidateQueries({ queryKey: ['shifts'] })
    },
  })
}

export function usePlacementAssignment(id: string, worker: string) {
  const qc = useQueryClient()
  const preview = useQuery({ queryKey: ['placements', id, 'assignment', worker],
    queryFn: () => placementsApi.previewAssignment(id, worker), enabled: Boolean(id && worker), retry: false })
  const assign = useMutation({
    mutationFn: () => placementsApi.assign(id, { employment_id: worker }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['placements'] }); qc.invalidateQueries({ queryKey: ['care-actions'] })
      qc.invalidateQueries({ queryKey: ['shifts'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
  return { preview, assign }
}

export function useClosePlacement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => placementsApi.close(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['placements'] }); qc.invalidateQueries({ queryKey: ['care-actions'] })
    },
  })
}

export function useApproveCareSlots(id: string) {
  const qc = useQueryClient()
  const review = useMutation({ mutationFn: (payload: ApprovalPayload) => placementsApi.review(id, payload) })
  const approve = useMutation({ mutationFn: (payload: ApprovalPayload) => placementsApi.approve(id, payload),
    onSuccess: () => { for (const key of ['placements', 'shifts', 'workers', 'worker', 'clients', 'weekly-care-need', 'notifications', 'care-actions']) qc.invalidateQueries({ queryKey: [key] }) } })
  return { review, approve }
}
