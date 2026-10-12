import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/shared/lib/api-client";
import type { Notification } from "@/features/notifications/api";
import { useOvertimeReviewStore } from "@/features/notifications/useOvertimeReviewStore";
import { useReadActivity } from "./useActivity";
import type { ActivityEntry } from "../types";

export function useOpenOvertime() {
  const open = useOvertimeReviewStore((s) => s.open);
  const read = useReadActivity();
  return useMutation({
    mutationFn: async (id: string) =>
      (await apiClient.get<Notification>(`/api/shifts/overtime-requests/${id}`))
        .data,
    onSuccess: (result) => {
      open(result);
      read.mutate([
        { id: `notice:${result.id}`, unread: true } as ActivityEntry,
      ]);
    },
  });
}
