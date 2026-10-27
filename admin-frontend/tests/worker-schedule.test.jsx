import { describe, expect, test } from 'vitest'
import { buildWorkerRows, calendarWeekWidth, visitTimeLabel } from '../src/features/shifts/lib/workerSchedule'

const worker = { id: 'worker', first_name: 'Alex', last_name: 'Demo' }
const idle = { id: 'idle', first_name: 'Morgan', last_name: 'Demo' }
const visit = (id, start, end, status = 'scheduled', extra = {}) => ({
  shift_id: id, date: start.slice(0, 10), start_time: start, end_time: end,
  completion_status: status, worker, client: { id: 'client', first_name: 'Evelyn', last_name: 'Demo' }, ...extra,
})

describe('worker schedule projection', () => {
  test('places moved visits by effective time while retaining original identity and zero-hour workers', () => {
    const moved = visit('moved', '2026-10-27T09:00:00', '2026-10-27T11:30:00', 'scheduled', { date: '2026-10-26' })
    const rows = buildWorkerRows([idle, worker], [moved, moved], '2026-10-25')
    expect(rows[0].hours).toBe(2.5)
    expect(rows[0].days[1]).toEqual([])
    expect(rows[0].days[2]).toEqual([moved])
    expect(rows[1].hours).toBe(0)
  })
  test('retains cancelled/dropped cards but excludes their hours; includes workers retained in visits', () => {
    const visits = ['scheduled', 'completed', 'no_show', 'cancelled', 'dropped'].map((status, i) => visit(`${i}`, '2026-10-26T09:00:00', '2026-10-26T10:00:00', status))
    const [row] = buildWorkerRows([], visits, '2026-10-25')
    expect(row.days[1]).toHaveLength(5)
    expect(row.hours).toBe(3)
  })
  test('splits overnight display, clips hours at week boundaries and counts a visit only once', () => {
    const visits = [
      visit('incoming', '2026-10-24T22:00:00', '2026-10-25T02:00:00'),
      visit('night', '2026-10-26T22:00:00', '2026-10-27T02:00:00'),
      visit('outgoing', '2026-10-31T22:00:00', '2026-11-01T02:00:00'),
      visit('midnight', '2026-10-28T22:00:00', '2026-10-29T00:00:00'),
    ]
    const [row] = buildWorkerRows([worker], visits, '2026-10-25')
    expect(row.hours).toBe(10)
    expect(row.days.map(day => day.length)).toEqual([1, 1, 1, 1, 0, 0, 1])
    expect(visitTimeLabel(visits[1])).toBe('10-26 22:00 – 10-27 02:00')
  })
  test('wall-time hours do not change with browser daylight saving rules', () => {
    expect(buildWorkerRows([worker], [visit('dst', '2026-11-01T00:00:00', '2026-11-01T04:00:00')], '2026-11-01')[0].hours).toBe(4)
  })
  test('calendar width grows for concurrent visits, not adjacent visits or visits outside the week', () => {
    const a = visit('a', '2026-10-26T09:00:00', '2026-10-26T11:00:00')
    const b = visit('b', '2026-10-26T11:00:00', '2026-10-26T13:00:00')
    const c = visit('c', '2026-10-26T10:00:00', '2026-10-26T12:00:00')
    expect(calendarWeekWidth([a, b], '2026-10-25')).toBe(calendarWeekWidth([a], '2026-10-25'))
    expect(calendarWeekWidth([a, b, c], '2026-10-25')).toBeGreaterThan(calendarWeekWidth([a, b], '2026-10-25'))
  })
})
