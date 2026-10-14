import { apiClient } from '@/shared/lib/api-client'

export interface BillingReview {
  id: string; org_id: string; period_id: string; submitted_at: string
  message: string; status: 'open' | 'resolved'; response: string | null; resolved_at: string | null
}
export const reviewApi = {
  list: async (period: string): Promise<BillingReview[]> => (await apiClient.get(`/api/billing/usage/periods/${period}/review-requests`)).data,
  submit: async (period: string, payload: { request_id: string; message: string }): Promise<BillingReview> =>
    (await apiClient.post(`/api/billing/usage/periods/${period}/review-requests`, payload)).data,
  queue: async (): Promise<{ requests: (BillingReview & { agency_name: string })[]; has_more: boolean }> =>
    (await apiClient.get('/api/billing/operator/review-requests')).data,
  resolve: async (id: string, response: string): Promise<BillingReview> =>
    (await apiClient.post(`/api/billing/operator/review-requests/${id}/resolve`, { response })).data,
}
