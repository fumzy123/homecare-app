export type AttentionCategory =
  | "coverage"
  | "credentials"
  | "authorizations"
  | "schedule"
  | "workers"
  | "clients"
  | "documentation"
  | "billing";
export type AttentionStage =
  | "post_placement"
  | "review_interest"
  | "await_interest"
  | "cover_slots"
  | "replace_worker"
  | "review_dropped_visit"
  | "renew_credential"
  | "verify_credential"
  | "renew_authorization"
  | "review_schedule"
  | "review_overtime"
  | "await_approval"
  | "review_billing"
  | "view_update";
export interface AttentionItem {
  id: string;
  category: AttentionCategory;
  stage: AttentionStage;
  urgency: "urgent" | "upcoming" | "review" | "waiting";
  subject: string;
  detail: string;
  due_on: string | null;
  action_required?: boolean;
  notification_ids?: string[];
  unread_count?: number;
  covered_slots?: number | null;
  total_slots?: number | null;
  interested_workers?: Array<{
    id: string;
    name: string;
    slots: string[];
    unread: boolean;
  }>;
  target: {
    kind:
      | "placement"
      | "care_need"
      | "credential"
      | "authorization"
      | "visit"
      | "weekly_schedule"
      | "worker"
      | "billing"
      | "overtime"
      | "client"
      | "notes";
    record_id: string;
    detail_id: string | null;
    document_type: string | null;
    occurrence_date: string | null;
  };
}
export interface AttentionResponse {
  org_id: string;
  checked_at: string;
  week_start: string;
  week_end: string;
  items: AttentionItem[];
  unread_count?: number;
}
export const actionLabels: Record<AttentionStage, string> = {
  view_update: "View update",
  review_overtime: "Review overtime",
  await_approval: "View request",
  review_billing: "Review billing",
  post_placement: "Post placement",
  review_interest: "Review interested workers",
  await_interest: "View placement",
  cover_slots: "Resolve coverage",
  replace_worker: "Find replacement",
  review_dropped_visit: "Review visit outcome",
  renew_credential: "Review document",
  verify_credential: "Verify document",
  renew_authorization: "Review authorization",
  review_schedule: "Review weekly schedule",
};

export type AttentionTarget = AttentionItem["target"];
export interface ActivityEntry {
  id: string;
  situation_key: string;
  category: AttentionCategory;
  kind: "completed" | "update";
  title: string;
  detail: string;
  actor: string | null;
  mine: boolean;
  created_at: string;
  unread: boolean;
  target: AttentionTarget | null;
}
export interface ActivityPage {
  entries: ActivityEntry[];
  next_cursor: string | null;
  today: string;
  timezone: string;
}
export const categoryLabels: Record<AttentionCategory, string> = {
  coverage: "Care coverage",
  schedule: "Visits & scheduling",
  workers: "Workers",
  credentials: "Credentials & compliance",
  clients: "Client care",
  authorizations: "Funding authorizations",
  documentation: "Visit documentation",
  billing: "Agency billing",
};
