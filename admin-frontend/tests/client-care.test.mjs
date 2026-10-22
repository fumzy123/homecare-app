import test from 'node:test'
import assert from 'node:assert/strict'
import {
  currentCareNeed,
  careState,
  validateSlots,
  countsAsCare,
  visitHours,
} from '../src/features/clients/lib/care.ts'

const slot = (
  day,
  service = 'personal_care',
  start = '09:30',
  end = '11:30',
) => ({
  day_of_week: day,
  service_type: service,
  start_time: start,
  end_time: end,
})
const current = {
  id: 'current',
  version: 3,
  activated_at: '2026-09-28',
  scheduled_from: '2026-09-28',
  effective_from: '2026-09-28',
  ends_on: '2026-10-04',
  imported: false,
}
test('overview uses effective current care, not a newer proposed or future approved revision', () => {
  const proposed = {
    ...current,
    id: 'proposed',
    version: 5,
    activated_at: null,
    scheduled_from: null,
    effective_from: '2026-10-01',
    ends_on: null,
  }
  const future = {
    ...current,
    id: 'future',
    version: 4,
    scheduled_from: '2026-10-05',
    ends_on: null,
  }
  assert.equal(
    currentCareNeed([proposed, future, current], '2026-10-01')?.id,
    'current',
  )
  assert.equal(
    currentCareNeed([proposed, future, current], '2026-10-05')?.id,
    'future',
  )
  assert.equal(currentCareNeed([current], '2026-10-05'), undefined)
  assert.equal(
    currentCareNeed(
      [{ ...current, imported: true, activated_at: null }],
      '2026-10-01',
    )?.id,
    'current',
  )
})

test('care slots reject overlap, including different services; adjacent slots are allowed', () => {
  assert.match(validateSlots([]), /Add a care slot/)
  assert.match(
    validateSlots([slot('MO'), slot('MO', 'homemaking', '11:00', '12:00')]),
    /overlap/,
  )
  assert.equal(
    validateSlots([slot('MO'), slot('MO', 'homemaking', '11:30', '12:30')]),
    '',
  )
  assert.match(
    validateSlots([slot('MO', 'personal_care', '12:00', '11:00')]),
    /end time/,
  )
})
test('visit care totals exclude cancelled, missed and dropped visits', () => {
  const base = {
    start_time: '2026-10-01T09:30:00',
    end_time: '2026-10-01T11:30:00',
  }
  const visits = [
    'scheduled',
    'completed',
    'cancelled',
    'no_show',
    'dropped',
  ].map((completion_status) => ({ ...base, completion_status }))
  assert.equal(
    visits.filter(countsAsCare).reduce((sum, v) => sum + visitHours(v), 0),
    4,
  )
})


test('a future revision replaced before its start is never presented as upcoming care', () => {
  const need = { version: 2, scheduled_from: '2026-10-26', effective_from: '2026-10-21', activated_at: '2026-10-21', ends_on: '2026-10-23' }
  assert.equal(careState(need, '2026-10-21'), 'Replaced before starting')
  assert.equal(currentCareNeed([need], '2026-10-26'), undefined)
})
