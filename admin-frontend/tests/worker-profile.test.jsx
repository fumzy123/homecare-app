import { describe, expect, test } from 'vitest'
import {
  agencyClock,
  attendanceStats,
  attendanceVisits,
  availabilitySummary,
  credentialStatus,
  workerWeek,
} from '../src/features/workers/lib/profile'

const visit = (id, start, end, status = 'scheduled', extra = {}) => ({
  shift_id: id,
  date: start.slice(0, 10),
  start_time: start,
  end_time: end,
  completion_status: status,
  client: { id: 'client', first_name: 'Client', last_name: 'Demo' },
  ...extra,
})
describe('worker profile projections', () => {
  test('uses the agency calendar date at midnight and the DST boundary', () => {
    expect(
      agencyClock('America/St_Johns', new Date('2026-11-02T02:30:00Z')),
    ).toEqual({ today: '2026-11-01', now: '2026-11-01T23:00:00' })
    expect(
      agencyClock('America/St_Johns', new Date('2026-11-02T03:30:00Z')).today,
    ).toBe('2026-11-02')
  })
  test('counts effective visits once, clips overnight hours, and keeps non-counting statuses visible', () => {
    const moved = visit(
      'moved',
      '2026-11-03T09:00:00',
      '2026-11-03T11:00:00',
      'scheduled',
      { date: '2026-10-27' },
    )
    const data = workerWeek(
      [
        moved,
        moved,
        visit('incoming', '2026-10-31T22:00:00', '2026-11-01T02:00:00'),
        visit('night', '2026-11-04T22:00:00', '2026-11-05T02:00:00'),
        visit('outgoing', '2026-11-07T22:00:00', '2026-11-08T02:00:00'),
        visit(
          'cancelled',
          '2026-11-02T09:00:00',
          '2026-11-02T17:00:00',
          'cancelled',
        ),
        visit(
          'dropped',
          '2026-11-02T17:00:00',
          '2026-11-02T20:00:00',
          'dropped',
        ),
      ],
      '2026-11-01',
    )
    expect(data.hours).toBe(10)
    expect(data.count).toBe(4)
    expect(data.days.map((d) => d.hours)).toEqual([2, 0, 2, 2, 2, 0, 2])
    expect(data.days[1].visits).toHaveLength(2)
    expect(data.days[2].visits[0].date).toBe('2026-10-27')
    expect(data.clients[0].hours).toBe(10)
  })
  test('treats a credential expiring today as current and an uploaded renewal as needing review', () => {
    const credential = {
      file_url: 'private-object',
      verified_at: '2026-10-01',
      expiry_date: '2026-11-02',
    }
    expect(credentialStatus(credential, '2026-11-02')).toBe('expiring')
    expect(credentialStatus(credential, '2026-11-03')).toBe('expired')
    expect(
      credentialStatus({ ...credential, verified_at: null }, '2026-11-03'),
    ).toBe('review')
    expect(
      credentialStatus({ ...credential, file_url: null }, '2026-11-03'),
    ).toBe('missing')
  })
  test('does not invent full availability or combine different daily windows', () => {
    expect(availabilitySummary([])).toBe('No availability recorded')
    expect(
      availabilitySummary([
        { day_of_week: 'MO', start_time: '08:00:00', end_time: '12:00:00' },
        { day_of_week: 'WE', start_time: '13:00:00', end_time: '17:00:00' },
      ]),
    ).toBe('Mon · 8:00 am–12:00 pm; Wed · 1:00 pm–5:00 pm')
  })
  test('attendance separates missed, dropped and cancelled visits from future work', () => {
    const values = [
      'completed',
      'no_show',
      'dropped',
      'cancelled',
      'scheduled',
      'in_progress',
    ].map((status, i) =>
      visit(String(i), '2026-11-02T09:00:00', '2026-11-02T10:00:00', status),
    )
    expect(attendanceStats([...values, values[0]])).toMatchObject({
      completed: 1,
      missed: 1,
      dropped: 1,
      cancelled: 1,
    })
  })
  test('counts attendance in the effective start month without counting overnight carry-in twice', () => {
    const carry = visit(
      'carry',
      '2026-10-31T22:00:00',
      '2026-11-01T02:00:00',
      'completed',
    )
    const moved = visit(
      'moved',
      '2026-11-01T09:00:00',
      '2026-11-01T11:00:00',
      'completed',
      { date: '2026-10-28' },
    )
    const rows = attendanceVisits(
      [carry, moved, moved],
      '2026-11-01',
      '2026-11-30',
    )
    expect(rows).toEqual([moved])
    expect(attendanceStats(rows).completed).toBe(1)
  })
})

test('replacement resolution retains original absences and distinguishes cover assigned from completed', () => {
  const original = visit('original', '2026-12-14T10:00:00', '2026-12-14T12:00:00', 'cancelled', { replacement_shift_id: 'cover', absence_kind: 'recorded_leave' })
  const covered = visit('cover', '2026-12-14T10:00:00', '2026-12-14T12:00:00', 'scheduled', { replacement_for: { shift_id: 'original' } })
  expect(attendanceStats([original, original])).toMatchObject({ dropped: 1, leaveAbsences: 1, otherDrops: 0, cancelled: 0 })
  expect(attendanceStats([covered])).toMatchObject({ replacementAssigned: 1, replacementCompleted: 0, dropped: 0 })
  expect(attendanceStats([{ ...covered, completion_status: 'completed' }])).toMatchObject({ replacementAssigned: 1, replacementCompleted: 1 })
  expect(attendanceStats([{ ...original, absence_kind: 'unspecified_drop' }])).toMatchObject({ dropped: 1, otherDrops: 1, leaveAbsences: 0 })
})
