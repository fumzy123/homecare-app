import { apiClient } from '@/shared/lib/api-client'
import type { BillingPeriodHistory, BillingSettlement, BillingCorrection } from './api'

export interface OperatorAccess { is_operator: boolean; onboarding_enabled: boolean; settlement_enabled: boolean; live_settlement_enabled: boolean }
export interface OperatorAgency { id: string; name: string; subscription_status: string | null; onboarding_deadline_at: string | null; deleted_at: string | null }
export interface OperatorAgencyDetails {
  organization: OperatorAgency & { onboarding_completed_at: string | null; trial_starts_at: string | null; trial_ends_at: string | null; billing_recovery_checked_at: string | null; billing_recovery_error: string | null }
  plan: { code: string; interval: string; card_saved: boolean; canceled: boolean } | null
  activation: { status: string; starts_at: string; ends_at: string; requested_at: string; attempted_at: string | null } | null
  founding: { slot: number; released: boolean; forfeited: boolean; protection_ends_at: string | null } | null
  conversion: { status: string; effective_at: string; notice_at: string } | null
  issues: {
    settlements: { id: string; period_id: string; state: string; payment_status: string | null; error_code: string | null; invoice_id: string | null; updated_at: string }[]
    cutoffs: { starts_at: string; ends_at: string; reason: string | null }[]
    holds: { invoice_id: string; state: string; usage_starts_at: string; usage_ends_at: string }[]
    has_more: boolean
  }
}
export interface OperatorCorrection extends BillingCorrection {
  payload: { baseline_clients: { client_id: string }[]; corrected_clients: { client_id: string }[];
    added_client_ids: string[]; removed_client_ids: string[]; baseline_usage_amount_cents: number;
    corrected_usage_amount_cents: number; included_clients: number; additional_client_amount_cents: number }
}
export interface OperatorCorrections {
  adjustments: OperatorCorrection[]
  events: { id: string; adjustment_id: string; action: string; actor_id: string; reason: string; occurred_at: string }[]
}
export type OperatorAction = 'trial-activation' | 'founding-offer' | 'founding-offer/release' | 'recheck'
const root = '/api/billing/operator'
export const operatorApi = {
  webhooks: async (): Promise<{ events: { event_id: string; event_type: string; state: string; attempts: number; received_at: string; updated_at: string; next_attempt_at: string; lease_until: string | null; error_code: string | null }[]; has_more: boolean }> => (await apiClient.get(`${root}/webhooks`)).data,
  access: async (): Promise<OperatorAccess> => (await apiClient.get(`${root}/access`)).data,
  agencies: async (search: string, before?: string): Promise<{ agencies: OperatorAgency[]; next_cursor: string | null }> =>
    (await apiClient.get(`${root}/organizations`, { params: { search, before } })).data,
  agency: async (org: string): Promise<OperatorAgencyDetails> => (await apiClient.get(`${root}/organizations/${org}`)).data,
  periods: async (org: string, before?: string): Promise<{ periods: BillingPeriodHistory[]; next_cursor: string | null }> =>
    (await apiClient.get(`${root}/organizations/${org}/periods`, { params: { before } })).data,
  action: async (org: string, action: OperatorAction): Promise<unknown> => (await apiClient.post(`${root}/organizations/${org}/${action}`)).data,
  corrections: async (org: string, period: string): Promise<OperatorCorrections> => (await apiClient.get(`${root}/organizations/${org}/periods/${period}/adjustments`)).data,
  settlements: async (org: string, period: string): Promise<BillingSettlement[]> => (await apiClient.get(`${root}/organizations/${org}/periods/${period}/settlements`)).data,
  propose: async (org: string, period: string, body: { request_id: string; reason: string }): Promise<OperatorCorrection> =>
    (await apiClient.post(`${root}/organizations/${org}/periods/${period}/adjustments`, body)).data,
  decide: async (org: string, period: string, body: { id: string; decision: 'approved' | 'rejected'; reason: string }): Promise<OperatorCorrection> =>
    (await apiClient.post(`${root}/organizations/${org}/periods/${period}/adjustments/${body.id}/decision`, { decision: body.decision, reason: body.reason })).data,
}
