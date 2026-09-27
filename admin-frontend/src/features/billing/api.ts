import { apiClient } from '@/shared/lib/api-client'

export interface BillingStatus {
  subscription_status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete' | 'paused' | null
  subscription_current_period_end: string | null
  is_trial_active: boolean
  trial_days_left: number
  trial_ends_at: string | null
  has_access: boolean
  new_billing_flow?: boolean
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

export const billingApi = {
  getOnboardingOptions: async (): Promise<OnboardingOptions> => (await apiClient.get('/api/billing/onboarding/options')).data,
  setupOnboardingCard: async (payload: { interval: 'month' | 'year'; consent_version: string; accepted: true }): Promise<{ url: string | null; card_saved: boolean }> =>
    (await apiClient.post('/api/billing/onboarding/card-setup', payload)).data,
  confirmOnboardingCard: async () => (await apiClient.post('/api/billing/onboarding/confirm-card')).data,
  cancelOnboarding: async () => (await apiClient.post('/api/billing/onboarding/cancel')).data,
  getStatus: async (): Promise<BillingStatus> => {
    const { data } = await apiClient.get('/api/billing/status')
    return data
  },

  createSubscriptionIntent: async (): Promise<{ client_secret: string }> => {
    const { data } = await apiClient.post('/api/billing/subscribe', {})
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
