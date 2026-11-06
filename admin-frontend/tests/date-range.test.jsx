import { expect, test } from 'vitest'
import { formatDateRange } from '../src/shared/lib/date'

test.each([
  ['2026-12-14', '2026-12-14', 'Dec 14th, 2026'],
  ['2026-12-11', '2026-12-13', 'Dec 11th – 13th 2026'],
  ['2026-11-29', '2026-12-05', 'Nov 29th – Dec 5th 2026'],
  ['2026-12-27', '2027-01-02', 'Dec 27th 2026 – Jan 2nd 2027'],
])('formats %s through %s without repeating a single date', (start, end, expected) => {
  expect(formatDateRange(start, end)).toBe(expected)
})
