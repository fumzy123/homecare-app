import { apiClient } from '@/shared/lib/api-client'

export type RecurrenceFrequency = 'daily' | 'weekly'
export type DayOfWeek = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU'

export const DAY_LABELS: Record<DayOfWeek, string> = {
  MO: 'Mon',
  TU: 'Tue',
  WE: 'Wed',
  TH: 'Thu',
  FR: 'Fri',
  SA: 'Sat',
  SU: 'Sun',
}

export const ORDERED_DAYS: DayOfWeek[] = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']

export interface ShiftWorker {
  id: string
  first_name: string
  last_name: string
  email: string
}

export interface ShiftClient {
  id: string
  first_name: string
  last_name: string
}

export interface ShiftOccurrence {
  shift_id: string
  modification_id: string | null
  date: string
  start_time: string
  end_time: string
  completion_status: string
  is_modification: boolean
  is_recurring: boolean
  worker: ShiftWorker
  client: ShiftClient
  location: string | null
  notes: string | null
}

export interface ShiftCreatePayload {
  worker_id: string
  client_id: string
  start_time: string   // ISO datetime
  end_time: string     // ISO datetime
  location?: string    // defaults to client address on the backend
  notes?: string
  recurrence?: {
    frequency: RecurrenceFrequency
    days_of_week?: DayOfWeek[]
    recurrence_end_date?: string  // YYYY-MM-DD
  }
}

export interface ShiftUpdatePayload {
  worker_id?: string
  client_id?: string
  start_time?: string  // ISO datetime
  end_time?: string    // ISO datetime
  location?: string
  notes?: string
}

export interface ShiftModificationPayload {
  original_date: string   // YYYY-MM-DD — identifies which occurrence
  new_start_time?: string // ISO datetime
  new_end_time?: string   // ISO datetime
  notes?: string
}

export interface ShiftModificationUpdatePayload {
  new_start_time?: string // ISO datetime
  new_end_time?: string   // ISO datetime
  notes?: string
}

// Shape react-big-calendar expects
export interface CalendarEvent {
  title: string
  start: Date
  end: Date
  resource: ShiftOccurrence
}

export function toCalendarEvents(occurrences: ShiftOccurrence[]): CalendarEvent[] {
  return occurrences.map((o) => ({
    title: `${o.worker.first_name} · ${o.client.first_name} ${o.client.last_name}`,
    start: new Date(o.start_time),
    end: new Date(o.end_time),
    resource: o,
  }))
}

export const shiftsApi = {
  listShifts: async (fromDate: string, toDate: string): Promise<ShiftOccurrence[]> => {
    const { data } = await apiClient.get('/api/shifts/', {
      params: { from_date: fromDate, to_date: toDate },
    })
    return data
  },

  createShift: async (payload: ShiftCreatePayload): Promise<void> => {
    await apiClient.post('/api/shifts/', payload)
  },

  updateShift: async (shiftId: string, payload: ShiftUpdatePayload): Promise<void> => {
    await apiClient.patch(`/api/shifts/${shiftId}`, payload)
  },

  createModification: async (shiftId: string, payload: ShiftModificationPayload): Promise<void> => {
    await apiClient.post(`/api/shifts/${shiftId}/modifications`, payload)
  },

  updateModification: async (shiftId: string, originalDate: string, payload: ShiftModificationUpdatePayload): Promise<void> => {
    await apiClient.patch(`/api/shifts/${shiftId}/modifications/${originalDate}`, payload)
  },

  cancelShift: async (shiftId: string): Promise<void> => {
    await apiClient.delete(`/api/shifts/${shiftId}`)
  },
}
