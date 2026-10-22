import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validatePhone, normalizePhone, formatPhone } from '../src/shared/lib/phone.ts'
const cases = JSON.parse(readFileSync(new URL('../../backend/tests/fixtures/phone-cases.json', import.meta.url)))
for (const [input, expected] of cases.valid) test(`normalize ${input}`, () => {
  assert.equal(validatePhone(input), undefined)
  assert.equal(normalizePhone(input), expected)
  assert.equal(normalizePhone(formatPhone(input)), expected)
})
for (const input of cases.invalid) test(`reject ${input}`, () => {
  assert.ok(validatePhone(input))
  assert.throws(() => normalizePhone(input))
  assert.equal(formatPhone(input), input)
})
test('optional and required blanks', () => {
  for (const input of [null, undefined, '', '  ']) {
    assert.equal(validatePhone(input), undefined)
    assert.equal(normalizePhone(input), null)
    assert.equal(validatePhone(input, true), 'Phone number is required')
  }
})
