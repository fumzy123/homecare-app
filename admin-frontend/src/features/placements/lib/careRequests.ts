import { addDays, format, parseISO } from 'date-fns'
import type { Placement, PlacementDetail, ApprovalPayload } from '../api'
import type { CareSlot } from '@/features/weekly-care-need/api'

const weekdays = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']
// Existing postings store both fields in one snapshot. Split only the separator
// written by PostPlacementDrawer, leaving all other free text intact.
export function requestNotes(requirements?: string | null) {
  const text = (requirements ?? '').replace(/\r\n/g, '\n')
  const marker = 'Additional notes:\n'
  const index = text.startsWith(marker) ? 0 : text.indexOf(`\n\n${marker}`)
  if (index < 0) return { care: text, additional: '' }
  const start = index === 0 ? marker.length : index + 2 + marker.length
  return { care: text.slice(0, index), additional: text.slice(start) }
}
// Calendar dates stay local; a Saturday start may first produce care next week.
export function firstCareVisitDate(
  slots: Pick<CareSlot, 'day_of_week'>[],
  startsOn: string,
) {
  if (!slots.length) return startsOn
  const start = parseISO(startsOn)
  const weekday = (start.getDay() + 6) % 7
  const offset = Math.min(
    ...slots.map((s) => (weekdays.indexOf(s.day_of_week) - weekday + 7) % 7),
  )
  return format(addDays(start, offset), 'yyyy-MM-dd')
}
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
// Interest and office-arranged coverage share the same reviewed approval path.
// Never turn a removed interest into an office selection without a roster match.
export function validSelections(
  p: PlacementDetail,
  selected: Record<string, string>,
  activeWorkerIds: readonly string[] = [],
): ApprovalPayload['selections'] {
  return p.care_slots.flatMap((slot) => {
    const worker = selected[slot.id]
    if (slot.worker_id || !worker) return []
    const interested = p.interests.some(
      (w) => w.employment_id === worker && w.care_slot_ids.includes(slot.id),
    )
    if (interested) return [{ care_slot_id: slot.id, employment_id: worker }]
    return activeWorkerIds.includes(worker)
      ? [
          {
            care_slot_id: slot.id,
            employment_id: worker,
            assignment_source: 'admin_arranged' as const,
          },
        ]
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
