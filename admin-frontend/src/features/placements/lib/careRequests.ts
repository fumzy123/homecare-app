import { format, parseISO } from 'date-fns'
import type { Placement, PlacementDetail } from '../api'
import type { CareSlot } from '@/features/weekly-care-need/api'

const weekdays = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']
export function sortCareSlots<T extends CareSlot>(slots: T[]) {
  return [...slots].sort(
    (a, b) =>
      weekdays.indexOf(a.day_of_week) - weekdays.indexOf(b.day_of_week) ||
      a.start_time.localeCompare(b.start_time),
  )
}

export const requestDate = (date: string | null | undefined) =>
  date ? format(parseISO(date), 'MMM d, yyyy') : 'Not set'
export function requestStatus(p: Placement) {
  return p.status === 'filled'
    ? 'Fully covered'
    : p.status === 'closed'
      ? 'Closed'
      : p.covered_count > 0
        ? 'Partially covered'
        : 'Open'
}
export function sortRequests(requests: Placement[]) {
  return [...requests].sort(
    (a, b) =>
      Number(b.status === 'open') - Number(a.status === 'open') ||
      (a.start_date ?? '9999').localeCompare(b.start_date ?? '9999') ||
      a.created_at.localeCompare(b.created_at) ||
      a.id.localeCompare(b.id),
  )
}
// Keep selections tied to currently open slots and actual expressions of interest.
export function validSelections(
  p: PlacementDetail,
  selected: Record<string, string>,
) {
  return p.care_slots.flatMap((slot) => {
    const worker = selected[slot.id]
    return !slot.worker_id &&
      worker &&
      p.interests.some(
        (w) => w.employment_id === worker && w.care_slot_ids.includes(slot.id),
      )
      ? [{ care_slot_id: slot.id, employment_id: worker }]
      : []
  })
}
export function selectWorkerSlots(
  p: PlacementDetail,
  selected: Record<string, string>,
  workerId: string,
) {
  const worker = p.interests.find((w) => w.employment_id === workerId)
  const next = { ...selected }
  // Preserve another worker's draft selection; the admin can change it per slot.
  for (const slot of p.care_slots)
    if (
      !slot.worker_id &&
      !next[slot.id] &&
      worker?.care_slot_ids.includes(slot.id)
    )
      next[slot.id] = workerId
  return next
}
