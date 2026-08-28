import { apiClient } from './api-client'

// Pre-launch draft. Change this only when a reviewed legal version is released.
export const CURRENT_TERMS_VERSION = '0.1-draft'

export const legalApi = {
  getStatus: () =>
    apiClient.get<{ accepted: boolean; accepted_version: string | null; current_version: string }>('/api/legal/status').then((r) => r.data),

  acceptTerms: (version: string) =>
    apiClient.post<{ accepted: boolean; accepted_version: string; current_version: string }>('/api/legal/accept', { version }).then((r) => r.data),
}
