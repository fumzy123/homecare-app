import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { apiClient } from "@/shared/lib/api-client";
import { useAuthStore } from "@/shared/stores/auth";
import type { ActivityEntry, ActivityPage } from "../types";

export interface ActivityFilters {
  scope?: "mine" | "agency";
  day?: string;
  situation?: string;
  kind?: "all" | "completed" | "update";
}
export function useActivity(filters: ActivityFilters) {
  const userId = useAuthStore((s) => s.user?.id);
  return useInfiniteQuery({
    queryKey: ["activity", userId, filters],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }): Promise<ActivityPage> =>
      (
        await apiClient.get("/api/activity", {
          params: { ...filters, cursor: pageParam },
          signal,
        })
      ).data,
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    staleTime: 20_000,
    refetchInterval: 60_000,
  });
}

export function useReadActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entries: ActivityEntry[]) => {
      const unread = entries.filter((e) => e.unread);
      await apiClient.patch("/api/activity/read", {
        event_ids: unread
          .filter((e) => e.id.startsWith("event:"))
          .map((e) => e.id.slice(6))
          .slice(0, 100),
        notification_ids: unread
          .filter((e) => e.id.startsWith("notice:"))
          .map((e) => e.id.slice(7))
          .slice(0, 100),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["activity"] });
      void qc.invalidateQueries({ queryKey: ["attention-items"] });
    },
  });
}
