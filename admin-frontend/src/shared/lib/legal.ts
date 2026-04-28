import { apiClient } from './api-client'

export const CURRENT_TERMS_VERSION = '1.0'

export const legalApi = {
  getStatus: () =>
    apiClient.get<{ accepted: boolean; accepted_version: string | null; current_version: string }>('/api/legal/status').then((r) => r.data),

  acceptTerms: (version: string) =>
    apiClient.post<{ accepted: boolean; accepted_version: string; current_version: string }>('/api/legal/accept', { version }).then((r) => r.data),
}
