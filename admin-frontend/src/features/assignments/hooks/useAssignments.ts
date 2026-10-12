import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { assignmentsApi, type AssignmentFilter, type EndAssignments } from '../api'

export function useAssignments(filter: AssignmentFilter) {
  return useQuery({ queryKey: ['assignments', filter], queryFn: () => assignmentsApi.list(filter),
    enabled: Boolean(filter.worker_id || filter.client_id), refetchOnWindowFocus: true })
}

export function useEndAssignments() {
  const queryClient = useQueryClient()
  const review = useMutation({ mutationFn: (payload: EndAssignments) => assignmentsApi.review(payload) })
  const end = useMutation({
    mutationFn: (payload: EndAssignments) => assignmentsApi.end(payload),
    onSuccess: async () => {
      await Promise.all(['assignments', 'placements', 'shifts', 'workers', 'worker', 'clients', 'client',
        'care-metrics', 'weekly-care-need', 'care-actions', 'attention-items', 'notifications',
      ].map(key => queryClient.invalidateQueries({ queryKey: [key] })))
    },
  })
  return { review, end }
}
