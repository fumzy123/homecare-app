import type { ShiftOccurrence } from '../api'

export interface ScheduleWorker {
  id: string
  first_name: string
  last_name: string
}

// API timestamps are agency-local wall times, without an offset. UTC arithmetic
// here keeps duration/date grouping independent of the browser's DST rules.
const wallTime = (value: string) => Date.parse(`${value.slice(0, 19)}Z`)
const dayMs = 86_400_000

export function buildWorkerRows(workers: ScheduleWorker[], visits: ShiftOccurrence[], from: string) {
  const start = wallTime(`${from}T00:00:00`)
  const end = start + 7 * dayMs
  const rows = new Map(workers.map(worker => [worker.id, {
    worker, hours: 0, days: Array.from({ length: 7 }, () => [] as ShiftOccurrence[]),
  }]))
  const seen = new Set<string>()
  for (const visit of [...visits].sort((a, b) => a.start_time.localeCompare(b.start_time))) {
    const key = `${visit.shift_id}:${visit.date}`
    if (seen.has(key)) continue
    seen.add(key)
    const a = Math.max(start, wallTime(visit.start_time))
    const b = Math.min(end, wallTime(visit.end_time))
    if (!(b > a)) continue
    let row = rows.get(visit.worker.id)
    if (!row) {
      row = { worker: visit.worker, hours: 0, days: Array.from({ length: 7 }, () => []) }
      rows.set(visit.worker.id, row)
    }
    if (!['cancelled', 'dropped'].includes(visit.completion_status)) row.hours += (b - a) / 3_600_000
    for (let day = Math.floor((a - start) / dayMs); day < 7 && start + day * dayMs < b; day++) {
      row.days[day].push(visit)
    }
  }
  return [...rows.values()].sort((a, b) =>
    `${a.worker.first_name} ${a.worker.last_name}`.localeCompare(`${b.worker.first_name} ${b.worker.last_name}`)
    || a.worker.id.localeCompare(b.worker.id))
}

export function visitTimeLabel(visit: ShiftOccurrence) {
  const start = visit.start_time.slice(11, 16)
  const end = visit.end_time.slice(11, 16)
  return visit.start_time.slice(0, 10) === visit.end_time.slice(0, 10)
    ? `${start}–${end}`
    : `${visit.start_time.slice(5, 10)} ${start} – ${visit.end_time.slice(5, 10)} ${end}`
}

// Give concurrent calendar events a readable minimum width. The calendar still
// positions visits by time; additional width is available through scrolling.
export function calendarWeekWidth(visits: ShiftOccurrence[], from: string) {
  const start = wallTime(`${from}T00:00:00`)
  let peak = 1
  for (let day = 0; day < 7; day++) {
    const a = start + day * dayMs, b = a + dayMs
    const points: [number, number][] = []
    for (const visit of visits) {
      const s = Math.max(a, wallTime(visit.start_time)), e = Math.min(b, wallTime(visit.end_time))
      if (e > s) points.push([s, 1], [e, -1])
    }
    points.sort((x, y) => x[0] - y[0] || x[1] - y[1])
    let count = 0
    for (const [, delta] of points) { count += delta; peak = Math.max(peak, count) }
  }
  return 65 + 7 * Math.max(160, peak * 136 + 12)
}
