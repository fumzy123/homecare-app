import { apiClient } from '@/shared/lib/api-client'
import type { ServiceType, WeekDay } from '@/features/authorizations/api'
export interface CareSlotInput { day_of_week: WeekDay; start_time: string; end_time: string; service_type: ServiceType }
export interface CareSlot extends CareSlotInput { id: string }
export interface WeeklyCareNeed { id: string; client_id: string; version: number; imported: boolean; effective_from: string; created_at: string; activated_at: string | null; scheduled_from: string | null; ends_on: string | null; supersedes_id: string | null; care_slots: CareSlot[] }
export interface CreateWeeklyCareNeed { effective_from: string; care_slots: CareSlotInput[] }
export const weeklyCareNeedApi = {
  get: async (clientId: string): Promise<WeeklyCareNeed[]> => (await apiClient.get(`/api/clients/${clientId}/care-need`)).data,
  create: async (clientId: string, payload: CreateWeeklyCareNeed): Promise<WeeklyCareNeed> => (await apiClient.post(`/api/clients/${clientId}/care-need`, payload)).data,
}
