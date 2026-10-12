import test from 'node:test'
import assert from 'node:assert/strict'
import {
  currentCareNeed,
  authorizationForDate,
  fundingRows,
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
test('funding uses effective current care, not a newer proposed or future approved revision', () => {
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
test('each service retains its own allowance and uncovered slots still count as care needed', () => {
  const auth = {
    hours_period: 'bi_weekly',
    services: [
      { service_type: 'personal_care', authorized_hours: 28 },
      { service_type: 'homemaking', authorized_hours: 4 },
    ],
  }
  const slots = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA']
    .map((day) => slot(day))
    .concat(slot('SU', 'homemaking'))
  const rows = fundingRows(auth, slots)
  assert.deepEqual(
    rows.map((r) => [r.needed, r.remaining]),
    [
      [24, 4],
      [4, 0],
    ],
  )
  assert.equal(
    fundingRows(auth, [slot('MO', 'nursing')]).find(
      (r) => r.service === 'nursing',
    ).remaining,
    -4,
  )
  assert.equal(
    fundingRows({ ...auth, hours_period: 'per_week' }, slots)[0].limit,
    56,
  )
  assert.equal(
    fundingRows(
      {
        hours_period: 'per_month',
        services: [{ service_type: 'personal_care', authorized_hours: 65 }],
      },
      slots,
    )[0].limit,
    30,
  )
})
test('authorization selection excludes superseded, cancelled and future records', () => {
  const auth = {
    id: 'old',
    covering_start: '2026-01-01',
    covering_end: '2026-12-31',
    cancelled_at: null,
    supersedes_id: null,
  }
  assert.equal(
    authorizationForDate(
      [auth, { ...auth, id: 'new', supersedes_id: 'old' }],
      '2026-10-01',
    ).id,
    'new',
  )
  assert.equal(
    authorizationForDate(
      [{ ...auth, cancelled_at: '2026-09-01' }],
      '2026-10-01',
    ),
    undefined,
  )
  assert.equal(
    authorizationForDate(
      [{ ...auth, covering_start: '2026-11-01' }],
      '2026-10-01',
    ),
    undefined,
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
