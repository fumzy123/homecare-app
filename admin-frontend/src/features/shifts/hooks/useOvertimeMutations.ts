import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  shiftsApi,
  type OvertimeApprovalRequest,
  type OvertimeApproveRequest,
  type OvertimeRejectRequest,
} from "@/features/shifts/api";

export function useApproveOvertime() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: OvertimeApproveRequest) =>
      shiftsApi.approveOvertime(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["attention-items"] });
      void queryClient.invalidateQueries({ queryKey: ["activity"] });
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
    },
  });
}

export function useRejectOvertime() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: OvertimeRejectRequest) =>
      shiftsApi.rejectOvertime(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["attention-items"] });
      void queryClient.invalidateQueries({ queryKey: ["activity"] });
    },
  });
}

export function useRequestOvertime() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: OvertimeApprovalRequest) =>
      shiftsApi.requestOvertimeApproval(payload),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["attention-items"] });
      void client.invalidateQueries({ queryKey: ["activity"] });
    },
  });
}
