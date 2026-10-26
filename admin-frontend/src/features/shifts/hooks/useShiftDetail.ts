import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { shiftsApi, type NoteEntry } from "../api";
import { orgMembersApi } from "@/features/org-members/api";
import { clientsApi } from "@/features/clients/api";
import { useRef } from "react";
import { requireVisitConnection } from "../lib/visitWrite";

export function useShiftDetailWorkers(enabled: boolean) {
  return useQuery({
    queryKey: ["workers"],
    queryFn: () => orgMembersApi.listByRole("home_support_worker"),
    enabled,
  });
}
export function useShiftDetailClients(enabled: boolean) {
  return useQuery({
    queryKey: ["clients"],
    queryFn: () => clientsApi.listClients(),
    enabled,
  });
}
export function useShiftDetailWrite(options: {
  onSuccess: () => void;
  onError?: (error: Error) => void;
}) {
  const client = useQueryClient();
  const inFlight = useRef<Promise<void> | null>(null);
  return useMutation({
    // Never queue a visit change for an unexpected automatic save on reconnect.
    networkMode: "always",
    retry: false,
    mutationFn: (operation: () => Promise<void>) => {
      if (inFlight.current) return inFlight.current;
      requireVisitConnection();
      const pending = Promise.resolve().then(operation).finally(() => { inFlight.current = null; });
      inFlight.current = pending;
      return pending;
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["shifts"] });
      options.onSuccess();
    },
    onError: options.onError,
  });
}
export function useShiftDetailNote(shiftId: string, date: string) {
  return useQuery({
    queryKey: ["progress-note", shiftId, date],
    queryFn: () => shiftsApi.getProgressNote(shiftId, date),
  });
}
export function useSaveShiftDetailNote(shiftId: string, date: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (entries: NoteEntry[]) =>
      shiftsApi.upsertProgressNote(shiftId, date, entries),
    onSuccess: () => {
      void client.invalidateQueries({
        queryKey: ["progress-note", shiftId, date],
      });
      void client.invalidateQueries({ queryKey: ["activity"] });
    },
  });
}
