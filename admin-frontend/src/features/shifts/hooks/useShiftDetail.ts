import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { shiftsApi, type NoteEntry } from "../api";
import { orgMembersApi } from "@/features/org-members/api";
import { clientsApi } from "@/features/clients/api";

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
  return useMutation({
    mutationFn: (operation: () => Promise<void>) => operation(),
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
