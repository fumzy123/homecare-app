import test from 'node:test'
import assert from 'node:assert/strict'
import { registrationTimezone, validTimezone, timezoneOptions } from '../src/features/organization/timezones.ts'

test('email verification on another device preserves the chosen agency timezone', () => {
  const selected = registrationTimezone('America/St_Johns', undefined, 'America/Vancouver')
  assert.equal(selected, 'America/St_Johns')
  assert.ok(timezoneOptions(selected).includes(selected))
})

test('older registrations can recover the same-account local choice or use the device suggestion', () => {
  assert.equal(registrationTimezone(undefined, 'America/Halifax', 'America/Vancouver'), 'America/Halifax')
  assert.equal(registrationTimezone(undefined, undefined, 'America/Vancouver'), 'America/Vancouver')
})

test('invalid stored values do not silently become an agency timezone', () => {
  for (const value of ['', 'Not/A_Timezone', ' America/St_Johns ', null, {}, 123]) {
    assert.equal(validTimezone(value), false)
  }
  assert.equal(registrationTimezone('Not/A_Timezone', {}, 'America/St_Johns'), 'America/St_Johns')
  assert.equal(registrationTimezone(undefined, undefined, ''), '')
})
