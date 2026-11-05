import { addDays, format, parseISO, startOfWeek } from 'date-fns'
import type {
  AvailabilityEntry,
  WorkerCredential,
  WeekDay,
} from '@/features/org-members/api'
import type { ShiftOccurrence } from '@/features/shifts/api'

export const WORKER_DAYS: { key: WeekDay; label: string }[] = [
  { key: 'SU', label: 'Sun' },
  { key: 'MO', label: 'Mon' },
  { key: 'TU', label: 'Tue' },
  { key: 'WE', label: 'Wed' },
  { key: 'TH', label: 'Thu' },
  { key: 'FR', label: 'Fri' },
  { key: 'SA', label: 'Sat' },
]
export const hoursLabel = (hours: number) => Number(hours.toFixed(1)).toString()
export const dateLabel = (value: string, pattern = 'MMM d, yyyy') =>
  format(parseISO(value.slice(0, 10)), pattern)
export const timeLabel = (value: string) =>
  format(parseISO(`2000-01-01T${value.slice(0, 5)}`), 'h:mm a').toLowerCase()
export const weekFrom = (date: string) =>
  format(startOfWeek(parseISO(date), { weekStartsOn: 0 }), 'yyyy-MM-dd')
export const shiftDate = (date: string, days: number) =>
  format(addDays(parseISO(date), days), 'yyyy-MM-dd')
const wallTime = (value: string) => Date.parse(`${value.slice(0, 19)}Z`)
export const countsHours = (visit: ShiftOccurrence) =>
  !['cancelled', 'dropped'].includes(visit.completion_status)

export function agencyClock(timezone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)!.value
  const today = `${get('year')}-${get('month')}-${get('day')}`
  return {
    today,
    now: `${today}T${get('hour')}:${get('minute')}:${get('second')}`,
  }
}

export function visitHoursInWindow(
  visit: ShiftOccurrence,
  from: string,
  until: string,
) {
  if (!countsHours(visit)) return 0
  return (
    Math.max(
      0,
      Math.min(wallTime(visit.end_time), wallTime(`${until}T00:00:00`)) -
        Math.max(wallTime(visit.start_time), wallTime(`${from}T00:00:00`)),
    ) / 3_600_000
  )
}

export function uniqueVisits(visits: ShiftOccurrence[]) {
  return [
    ...new Map(visits.map((v) => [`${v.shift_id}:${v.date}`, v])).values(),
  ].sort((a, b) => a.start_time.localeCompare(b.start_time))
}

export function workerWeek(visits: ShiftOccurrence[], from: string) {
  const until = shiftDate(from, 7)
  const rows = uniqueVisits(visits).filter(v => !v.replacement_shift_id).filter(
    (v) =>
      v.start_time < `${until}T00:00:00` && v.end_time > `${from}T00:00:00`,
  )
  const days = WORKER_DAYS.map((day, index) => {
    const date = shiftDate(from, index),
      end = shiftDate(date, 1)
    return {
      ...day,
      date,
      hours: rows.reduce(
        (total, v) => total + visitHoursInWindow(v, date, end),
        0,
      ),
      visits: rows.filter(
        (v) =>
          v.start_time < `${end}T00:00:00` && v.end_time > `${date}T00:00:00`,
      ),
    }
  })
  const clients = new Map<
    string,
    { id: string; name: string; hours: number; days: Set<string> }
  >()
  for (const visit of rows.filter(countsHours)) {
    const c = clients.get(visit.client.id) || {
      id: visit.client.id,
      name: `${visit.client.first_name} ${visit.client.last_name}`,
      hours: 0,
      days: new Set<string>(),
    }
    c.hours += visitHoursInWindow(visit, from, until)
    for (const day of days)
      if (day.visits.includes(visit)) c.days.add(day.label)
    clients.set(c.id, c)
  }
  return {
    days,
    visits: rows,
    hours: days.reduce((n, d) => n + d.hours, 0),
    count: rows.filter(countsHours).length,
    clients: [...clients.values()],
  }
}

export function availabilitySummary(entries: AvailabilityEntry[]) {
  if (!entries.length) return 'No availability recorded'
  const groups = new Map<string, string[]>()
  for (const day of WORKER_DAYS) {
    const times = entries
      .filter((e) => e.day_of_week === day.key)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
      .map((e) => `${timeLabel(e.start_time)}–${timeLabel(e.end_time)}`)
      .join(', ')
    if (times) groups.set(times, [...(groups.get(times) || []), day.label])
  }
  return [...groups]
    .map(([times, days]) => {
      const first = WORKER_DAYS.findIndex((day) => day.label === days[0])
      const consecutive = days.every(
        (label, i) => WORKER_DAYS[first + i]?.label === label,
      )
      const label =
        consecutive && days.length > 2
          ? `${days[0]}–${days.at(-1)}`
          : days.join(', ')
      return `${label} · ${times}`
    })
    .join('; ')
}

export type CredentialStatus =
  | 'missing'
  | 'review'
  | 'expired'
  | 'expiring'
  | 'verified'
export const credentialLabels: Record<CredentialStatus, string> = {
  missing: 'Not on file',
  review: 'Needs review',
  expired: 'Expired',
  expiring: 'Expiring soon',
  verified: 'Verified',
}
export function credentialStatus(
  credential: WorkerCredential | undefined,
  today: string,
): CredentialStatus {
  if (!credential?.file_url) return 'missing'
  if (!credential.verified_at) return 'review'
  if (credential.expiry_date && credential.expiry_date < today) return 'expired'
  if (credential.expiry_date && credential.expiry_date <= shiftDate(today, 30))
    return 'expiring'
  return 'verified'
}
export const credentialPriority: Record<CredentialStatus, number> = {
  expired: 0,
  review: 1,
  expiring: 2,
  verified: 3,
  missing: 4,
}

// Outcomes belong to the effective start date, so an overnight visit is not
// counted again in the next month. The calendar endpoint includes carry-in visits.
export function attendanceVisits(
  visits: ShiftOccurrence[],
  from: string,
  to: string,
) {
  return uniqueVisits(visits).filter((v) => {
    const date = v.start_time.slice(0, 10)
    return date >= from && date <= to
  })
}

export function attendanceStats(visits: ShiftOccurrence[]) {
  const rows = uniqueVisits(visits)
  return {
    completed: rows.filter((v) => v.completion_status === 'completed').length,
    missed: rows.filter((v) => v.completion_status === 'no_show').length,
    dropped: rows.filter((v) => v.completion_status === 'dropped' || v.replacement_shift_id || v.absence_kind).length,
    leaveAbsences: rows.filter(v => v.absence_kind === 'recorded_leave').length,
    otherDrops: rows.filter(v => v.absence_kind === 'unspecified_drop' || (!v.absence_kind && (v.completion_status === 'dropped' || v.replacement_shift_id))).length,
    replacementAssigned: rows.filter(v => v.replacement_for).length,
    replacementCompleted: rows.filter(v => v.replacement_for && v.completion_status === 'completed').length,
    cancelled: rows.filter((v) => v.completion_status === 'cancelled' && !v.replacement_shift_id && !v.absence_kind).length,
  }
}
