import test from 'node:test'
import assert from 'node:assert/strict'
import {
  sortRequests,
  validSelections,
  selectWorkerSlots,
  requestDate,
  sortCareSlots,
  firstCareVisitDate,
  requestNotes,
} from '../src/features/placements/lib/careRequests.ts'
import { weeklyHours } from '../src/features/clients/lib/care.ts'

test('scheduled-care link uses the first selected visit, including a week/year boundary', () => {
  assert.equal(firstCareVisitDate([{ day_of_week: 'MO' }, { day_of_week: 'WE' }], '2026-10-17'), '2026-10-19')
  assert.equal(firstCareVisitDate([{ day_of_week: 'FR' }], '2026-12-31'), '2027-01-01')
  assert.equal(firstCareVisitDate([{ day_of_week: 'SA' }], '2026-10-17'), '2026-10-17')
})

test('care slots display in weekday and time order rather than the API enum order', () => {
  const slots = [
    { day_of_week: 'FR', start_time: '09:00' },
    { day_of_week: 'MO', start_time: '13:00' },
    { day_of_week: 'MO', start_time: '09:00' },
  ]
  assert.deepEqual(
    sortCareSlots(slots).map((s) => `${s.day_of_week} ${s.start_time}`),
    ['MO 09:00', 'MO 13:00', 'FR 09:00'],
  )
  assert.equal(slots[0].day_of_week, 'FR')
})

test('open requests sort first by care start, with undated records last, without mutating the response', () => {
  const rows = [
    {
      id: 'closed',
      status: 'closed',
      start_date: '2026-09-01',
      created_at: '2026-09-01',
    },
    {
      id: 'later',
      status: 'open',
      start_date: '2026-10-10',
      created_at: '2026-09-01',
    },
    {
      id: 'undated',
      status: 'open',
      start_date: null,
      created_at: '2026-09-01',
    },
    {
      id: 'overdue',
      status: 'open',
      start_date: '2026-10-01',
      created_at: '2026-09-01',
    },
  ]
  assert.deepEqual(
    sortRequests(rows).map((p) => p.id),
    ['overdue', 'later', 'undated', 'closed'],
  )
  assert.equal(rows[0].id, 'closed')
})
const p = {
  care_slots: [
    { id: 'short', worker_id: null, start_time: '09:00', end_time: '10:30' },
    { id: 'long', worker_id: null, start_time: '09:00', end_time: '13:00' },
    {
      id: 'covered',
      worker_id: 'existing',
      start_time: '09:00',
      end_time: '12:00',
    },
  ],
  interests: [
    { employment_id: 'maya', care_slot_ids: ['short', 'long', 'covered'] },
    { employment_id: 'daniel', care_slot_ids: ['long'] },
  ],
}
test('worker bulk selection preserves other draft choices and never replaces approved care', () => {
  assert.deepEqual(selectWorkerSlots(p, { long: 'daniel' }, 'maya'), {
    short: 'maya',
    long: 'daniel',
  })
})
test('removed interests, covered slots and unknown slots cannot enter approval payload', () => {
  assert.deepEqual(
    validSelections(p, {
      short: 'removed',
      long: 'daniel',
      covered: 'maya',
      unknown: 'maya',
    }),
    [{ care_slot_id: 'long', employment_id: 'daniel' }],
  )
})
test('hours reflect actual slot lengths, and calendar dates never shift with UTC parsing', () => {
  assert.equal(weeklyHours(p.care_slots.slice(0, 2)), 5.5)
  assert.equal(requestDate('2026-10-01'), 'Oct 1, 2026')
  assert.equal(requestDate(null), 'Not set')
})

test('active roster selection without interest explicitly records admin-arranged coverage', () => {
  assert.deepEqual(validSelections(p, { short: 'office', long: 'daniel', covered: 'office', unknown: 'office' }, ['office']), [
    { care_slot_id: 'short', employment_id: 'office', assignment_source: 'admin_arranged' },
    { care_slot_id: 'long', employment_id: 'daniel' },
  ])
  assert.deepEqual(validSelections(p, { short: 'office' }, []), [])
})

 test('posted notes separate the stored optional notes marker without dropping free text', () => {
  assert.deepEqual(requestNotes('Bath and cooking.\n\nAdditional notes:\nOne cat.'), { care: 'Bath and cooking.', additional: 'One cat.' })
  assert.deepEqual(requestNotes('Additional notes:\nOne cat.'), { care: '', additional: 'One cat.' })
  assert.deepEqual(requestNotes('Keep Additional notes: in this sentence.'), { care: 'Keep Additional notes: in this sentence.', additional: '' })
  assert.deepEqual(requestNotes(null), { care: '', additional: '' })
})
