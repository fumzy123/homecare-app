import type { AttentionItem } from "./types";
declare module "@tanstack/react-router" {
  interface HistoryState {
    attentionNavigationId?: string;
  }
}
export function attentionDestination(item: AttentionItem) {
  const t = item.target;
  switch (t.kind) {
    case "worker":
      return {
        to: "/dashboard/workers/$workerId/edit" as const,
        params: { workerId: t.record_id },
      };
    case "client":
      return {
        to: "/dashboard/clients/$clientId" as const,
        params: { clientId: t.record_id },
      };
    case "notes":
      return {
        to: "/dashboard/clients/$clientId/notes" as const,
        params: { clientId: t.record_id },
      };
    case "billing":
      return { to: "/settings/billing" as const };
    case "overtime":
      return { to: "/dashboard/activity" as const };
    case "placement":
      return {
        to: "/dashboard/placements/$placementId" as const,
        params: { placementId: t.record_id },
      };
    case "care_need":
      return {
        to: "/dashboard/clients/$clientId/care-need" as const,
        params: { clientId: t.record_id },
        search: { need: t.detail_id ?? undefined },
      };
    case "credential":
      return {
        to: "/dashboard/workers/$workerId/edit" as const,
        params: { workerId: t.record_id },
        search: { document: t.document_type ?? undefined },
      };
    case "authorization":
      return {
        to: "/dashboard/clients/$clientId/funding" as const,
        params: { clientId: t.record_id },
        search: { authorization: t.detail_id ?? undefined },
      };
    case "visit":
      return {
        to: "/dashboard/shifts" as const,
        search: {
          shift: t.record_id,
          date: item.due_on ?? t.occurrence_date ?? undefined,
          occurrence: t.occurrence_date ?? undefined,
        },
      };
    case "weekly_schedule":
      return {
        to: "/dashboard/shifts" as const,
        search: { client: t.record_id, date: t.occurrence_date ?? undefined },
      };
  }
}
