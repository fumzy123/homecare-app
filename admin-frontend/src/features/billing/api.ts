import { apiClient } from '@/shared/lib/api-client'

export interface BillingStatus {
  subscription_status: 'active' | 'past_due' | 'canceled' | 'unpaid' | null
  subscription_current_period_end: string | null
  is_trial_active: boolean
  trial_days_left: number
  trial_ends_at: string
  has_access: boolean
}

export const billingApi = {
  getStatus: async (): Promise<BillingStatus> => {
    const { data } = await apiClient.get('/api/billing/status')
    return data
  },

  createCheckoutSession: async (): Promise<{ url: string }> => {
    const { data } = await apiClient.post('/api/billing/checkout', {})
    return data
  },
}
