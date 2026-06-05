import { useMutation, useQueryClient } from '@tanstack/react-query'
import { shiftsApi, type OvertimeApproveRequest, type OvertimeRejectRequest } from '@/features/shifts/api'

export function useApproveOvertime() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: OvertimeApproveRequest) => shiftsApi.approveOvertime(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['shifts'] })
    },
  })
}

export function useRejectOvertime() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: OvertimeRejectRequest) => shiftsApi.rejectOvertime(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}
