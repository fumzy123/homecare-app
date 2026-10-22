import type {
  WeeklyCareNeed,
  CareSlotInput,
} from '@/features/weekly-care-need/api'
import type { ShiftOccurrence } from '@/features/shifts/api'

export function slotHours(slot: CareSlotInput) {
  const minutes = (time: string) => {
    const [h, m] = time.split(':').map(Number)
    return h * 60 + m
  }
  return Math.max(0, (minutes(slot.end_time) - minutes(slot.start_time)) / 60)
}
export const weeklyHours = (slots: CareSlotInput[]) =>
  slots.reduce((sum, slot) => sum + slotHours(slot), 0)
export function currentCareNeed(needs: WeeklyCareNeed[], today: string) {
  return [...needs]
    .sort((a, b) => b.version - a.version)
    .find(
      (need) =>
        (need.activated_at || need.imported) &&
        (need.scheduled_from || need.effective_from) <= today &&
        (!need.ends_on || need.ends_on >= today),
    )
}
export function careState(
  need: WeeklyCareNeed,
  today: string,
  posted = false,
  latest = true,
) {
  if (need.ends_on && need.ends_on < (need.scheduled_from || need.effective_from))
    return 'Replaced before starting'
  if (need.ends_on && need.ends_on < today) return 'Ended'
  if (need.activated_at || need.imported)
    return (need.scheduled_from || need.effective_from) > today
      ? 'Upcoming'
      : 'Current'
  if (!latest) return 'Superseded'
  return posted ? 'Posted · awaiting coverage' : 'Saved · not posted'
}
export function validateSlots(slots: CareSlotInput[]) {
  if (!slots.length) return 'Add a care slot and select at least one day.'
  if (slots.length > 100)
    return 'A weekly care need can contain up to 100 care slots.'
  for (const [i, slot] of slots.entries()) {
    if (!slot.start_time || !slot.end_time || slot.end_time <= slot.start_time)
      return 'Each care slot needs an end time after its start time.'
    if (
      slots
        .slice(0, i)
        .some(
          (other) =>
            other.day_of_week === slot.day_of_week &&
            other.start_time < slot.end_time &&
            slot.start_time < other.end_time,
        )
    )
      return 'Care slots cannot overlap on the same day.'
  }
  return ''
}
export const visitKey = (visit: { shift_id: string; date: string }) =>
  `${visit.shift_id}:${visit.date}`
export const visitHours = (visit: ShiftOccurrence) =>
  Math.max(
    0,
    (Date.parse(visit.end_time) - Date.parse(visit.start_time)) / 3600000,
  )
export const countsAsCare = (visit: ShiftOccurrence) =>
  ['scheduled', 'in_progress', 'completed'].includes(visit.completion_status)
export const errorMessage = (error: unknown) =>
  (
    error as {
      response?: { data?: { error?: { message?: string } } }
      message?: string
    }
  )?.response?.data?.error?.message ||
  (error as Error)?.message ||
  'Something went wrong. Please try again.'
