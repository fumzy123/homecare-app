import { addDays, format, parseISO } from 'date-fns'
import type { WeeklyCareNeed } from '@/features/weekly-care-need/api'
import type { Assignment } from '../api'

export const assignmentDate = (date: string) => format(parseISO(date), 'MMM d, yyyy')
const shiftDay = (date: string, days: number) => format(addDays(parseISO(date), days), 'yyyy-MM-dd')

// Assignment stops are exclusive; revision ends are inclusive. Never infer a
// revision from matching weekday/time: only retained Care Slot IDs prove it.
export function assignmentEnd(row: Assignment, revision: WeeklyCareNeed) {
  return [row.stops_from ? shiftDay(row.stops_from, -1) : null, row.revision_ends_on, revision.ends_on]
    .filter((date): date is string => Boolean(date)).sort()[0] || null
}

export function revisionAssignments(revision: WeeklyCareNeed, rows: Assignment[], today: string, revisions: WeeklyCareNeed[]) {
  const starts = revision.scheduled_from || revision.effective_from
  const approved = Boolean(revision.scheduled_from || revision.activated_at || revision.imported)
  const replaced = Boolean(revision.ends_on && revision.ends_on < starts)
  const historical = Boolean(revision.ends_on && revision.ends_on < today)
  const asOf = historical && !replaced ? revision.ends_on! : today < starts ? starts : today
  const slotIds = new Set(revision.care_slots.map(slot => slot.id))
  const assignments = rows.filter(row => slotIds.has(row.care_slot_id) && row.client_id === revision.client_id)
    .sort((a, b) => a.starts_on.localeCompare(b.starts_on) || a.id.localeCompare(b.id))
  const slots = [...revision.care_slots].sort((a, b) =>
    ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'].indexOf(a.day_of_week) - ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'].indexOf(b.day_of_week)
    || a.start_time.localeCompare(b.start_time)).map(slot => {
    const history = assignments.filter(row => row.care_slot_id === slot.id)
    const valid = history.filter(row => {
      const end = assignmentEnd(row, revision)
      return approved && !replaced && (!end || end >= row.starts_on) && (!end || end >= asOf)
    })
    return { slot, history, visible: valid, covered: valid.some(row => row.starts_on <= asOf) }
  })
  const successor = approved && revision.ends_on ? revisions.find(need => need.id !== revision.id
    && need.client_id === revision.client_id && need.scheduled_from === shiftDay(revision.ends_on!, 1)
    && (!need.ends_on || need.ends_on >= need.scheduled_from)) : undefined
  return { starts, approved, replaced, historical, asOf, assignments, slots, successor,
    covered: slots.filter(slot => slot.covered).length }
}
