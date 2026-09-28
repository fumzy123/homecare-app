import { apiClient } from '@/shared/lib/api-client'

export interface BillingStatus {
  subscription_status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete' | 'paused' | null
  subscription_current_period_end: string | null
  is_trial_active: boolean
  trial_days_left: number
  trial_ends_at: string | null
  has_access: boolean
  can_write?: boolean
  is_read_only?: boolean
  new_billing_flow?: boolean
  billing_timezone?: string | null
  is_onboarding?: boolean
  onboarding_deadline_at?: string
  trial_starts_at?: string | null
  card_saved?: boolean
  billing_canceled?: boolean
  activation_status?: string | null
  plan_interval?: 'month' | 'year' | null
  base_amount_cents?: number | null
  plan_code?: 'standard' | 'founding' | null
  additional_client_amount_cents?: number | null
  founding_protection_ends_at?: string | null
  founding_conversion?: {
    status: 'pending' | 'scheduled' | 'converted' | 'canceled' | 'needs_review'
    notice_at: string
    effective_at: string
    base_amount_cents: number
    additional_client_amount_cents: number
    included_clients: number
  } | null
  founding_notice_due_at?: string | null
}

export interface OnboardingOptions {
  timezones: string[]
  consent_version: string
  consent_text: string
  plans: { code: string; version: number; interval: 'month' | 'year'; base_amount_cents: number; currency: string; included_clients: number; additional_client_amount_cents: number }[]
}

export interface CardInfo {
  brand: string
  last4: string
  exp_month: number
  exp_year: number
  postal_code: string | null
}

export interface Invoice {
  id: string
  created: number
  description: string
  amount_paid: number
  currency: string
  status: string
  hosted_invoice_url: string
}

export interface BillingDetails {
  card: CardInfo | null
  invoices: Invoice[]
}

export interface HistoricalInvoice extends Omit<Invoice, 'hosted_invoice_url'> {
  number: string | null
  total: number
  amount_remaining: number
  hosted_invoice_url: string | null
}

export interface BillingPeriodHistory {
  period_id: string
  finalized_at: string
  starts_at: string
  ends_at: string
  agency_timezone: string
  active_client_count: number
  additional_clients: number
  usage_amount_cents: number
  currency: string
}

export interface BillingCorrection {
  id: string
  status: 'pending' | 'approved' | 'rejected'
  amount_cents: number
  currency: string
  reason: string
  proposed_at: string
  decision_reason: string | null
  settlement_status: string
}

export interface BillingSettlement {
  id: string
  adjustment_id: string | null
  amount_cents: number
  currency: string
  state: string
  payment_status: string | null
  invoice_id: string | null
}

export interface UpcomingBilling {
  calculated_at: string
  history_needs_review: boolean
  tax_status: 'not_calculated'
  base: {
    state: 'not_selected' | 'canceled' | 'after_trial' | 'needs_review' | 'first_payment' | 'scheduled'
    amount_cents: number | null
    scheduled_at: string | null
    interval: 'month' | 'year' | null
  }
  periods: {
    id: string
    starts_at: string
    ends_at: string
    agency_timezone: string
    finalization_eligible_at: string
    currency: string
    usage_amount_cents: number | null
    state: 'needs_review' | 'awaiting_finalization' | 'ready'
  }[]
  corrections: {
    id: string
    period_id: string
    amount_cents: number
    currency: string
    settlement_status: string
    state: string | null
    payment_status: string | null
  }[]
}

export interface CountedBillingClient {
  client_id: string
  client_name: string | null
  client_archived: boolean | null
  shift_id: string
  occurrence_date: string
  modification_id: string | null
  local_start: string
  completion_status: 'scheduled' | 'in_progress' | 'completed' | 'no_show'
}

export interface ReadyBillingUsage {
  state: 'ready'
  period: {
    id: string
    starts_at: string
    ends_at: string
    agency_timezone: string
    plan_code: 'standard' | 'founding'
    plan_version: number
    base_interval: 'month' | 'year'
    included_clients: number
    additional_client_amount_cents: number
    currency: string
    finalization_eligible_at: string
  }
  usage: {
    is_estimate: true
    calculated_at: string
    active_client_count: number
    additional_clients: number
    estimated_usage_amount_cents: number
    clients: CountedBillingClient[]
  }
}

export type CurrentBillingUsage = ReadyBillingUsage | { state: 'not_started' | 'no_current_period'; usage: null }

export const billingApi = {
  getUpcoming: async (): Promise<UpcomingBilling> => (await apiClient.get('/api/billing/upcoming')).data,
  getInvoiceHistory: async (before?: string): Promise<{ invoices: HistoricalInvoice[]; next_cursor: string | null }> =>
    (await apiClient.get('/api/billing/invoices', { params: { before } })).data,
  getUsageHistory: async (before?: string): Promise<{ periods: BillingPeriodHistory[]; next_cursor: string | null }> =>
    (await apiClient.get('/api/billing/usage/periods', { params: { before } })).data,
  getCorrections: async (periodId: string): Promise<{ adjustments: BillingCorrection[] }> =>
    (await apiClient.get(`/api/billing/usage/periods/${periodId}/adjustments`)).data,
  getSettlements: async (periodId: string): Promise<BillingSettlement[]> =>
    (await apiClient.get(`/api/billing/usage/periods/${periodId}/settlements`)).data,
  getCurrentUsage: async (): Promise<CurrentBillingUsage> => (await apiClient.get('/api/billing/usage/current')).data,
  setTimezone: async (timezone: string): Promise<{ billing_timezone: string }> =>
    (await apiClient.put('/api/billing/timezone', { timezone })).data,
  getOnboardingOptions: async (): Promise<OnboardingOptions> => (await apiClient.get('/api/billing/onboarding/options')).data,
  setupOnboardingCard: async (payload: { interval: 'month' | 'year'; consent_version: string; accepted: true }): Promise<{ url: string | null; card_saved: boolean }> =>
    (await apiClient.post('/api/billing/onboarding/card-setup', payload)).data,
  confirmOnboardingCard: async () => (await apiClient.post('/api/billing/onboarding/confirm-card')).data,
  cancelOnboarding: async () => (await apiClient.post('/api/billing/onboarding/cancel')).data,
  getStatus: async (): Promise<BillingStatus> => {
    const { data } = await apiClient.get('/api/billing/status')
    return data
  },

  createSetupIntent: async (): Promise<{ client_secret: string }> => {
    const { data } = await apiClient.post('/api/billing/setup-intent', {})
    return data
  },

  setDefaultCard: async (payment_method_id: string): Promise<void> => {
    await apiClient.post('/api/billing/set-default-card', { payment_method_id })
  },

  getBillingDetails: async (): Promise<BillingDetails> => {
    const { data } = await apiClient.get('/api/billing/details')
    return data
  },

  createPortalSession: async (): Promise<{ url: string }> => {
    const { data } = await apiClient.post('/api/billing/portal', {})
    return data
  },
}
