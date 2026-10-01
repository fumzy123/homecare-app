export type AttentionCategory = 'coverage' | 'credentials' | 'authorizations' | 'schedule'
export type AttentionStage = 'post_placement' | 'review_interest' | 'await_interest' | 'cover_slots' | 'replace_worker' | 'renew_credential' | 'verify_credential' | 'renew_authorization' | 'review_schedule'
export interface AttentionItem {
  id: string; category: AttentionCategory; stage: AttentionStage
  urgency: 'urgent' | 'upcoming' | 'review' | 'waiting'
  subject: string; detail: string; due_on: string | null
  target: { kind: 'placement' | 'care_need' | 'credential' | 'authorization' | 'visit' | 'weekly_schedule'; record_id: string; detail_id: string | null; document_type: string | null; occurrence_date: string | null }
}
export interface AttentionResponse { org_id: string; checked_at: string; week_start: string; week_end: string; items: AttentionItem[] }
export const actionLabels: Record<AttentionStage, string> = {
  post_placement: 'Post placement', review_interest: 'Review interested workers', await_interest: 'View placement',
  cover_slots: 'Resolve coverage', replace_worker: 'Find replacement', renew_credential: 'Review document',
  verify_credential: 'Verify document', renew_authorization: 'Review authorization', review_schedule: 'Review weekly schedule',
}
