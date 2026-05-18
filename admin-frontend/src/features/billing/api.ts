import { apiClient } from '@/shared/lib/api-client'

export interface BillingStatus {
  subscription_status: 'active' | 'past_due' | 'canceled' | 'unpaid' | null
  subscription_current_period_end: string | null
  is_trial_active: boolean
  trial_days_left: number
  trial_ends_at: string
  has_access: boolean
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
