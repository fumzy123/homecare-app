import { apiClient } from '@/shared/lib/api-client'

export interface PaymentStatus {
  has_paid: boolean
  paid_at: string | null
  is_trial_active: boolean
  trial_days_left: number
  trial_ends_at: string
}

export const paymentsApi = {
  getStatus: async (): Promise<PaymentStatus> => {
    const { data } = await apiClient.get('/api/payments/status')
    return data
  },

  createCheckoutSession: async (): Promise<{ url: string }> => {
    const { data } = await apiClient.post('/api/payments/checkout', {})
    return data
  },
}
