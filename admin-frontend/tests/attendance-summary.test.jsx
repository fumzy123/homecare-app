import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { AttendanceSummary } from '../src/features/workers/components/AttendanceSummary'
const stats = { completed: 3, missed: 1, dropped: 5, leaveAbsences: 2, otherDrops: 3, replacementCompleted: 2 }
test('preserves existing metrics alongside the breakdown and percentage', () => {
  const html = renderToStaticMarkup(<AttendanceSummary stats={stats} />)
  expect(html).toContain('Completed shifts')
  expect(html).toContain('Missed shifts')
  expect(html).toContain('Attendance rate: 75%')
  expect(html).toContain('Leave-related: 2')
  expect(html).toContain('Other dropped shifts: 3')
  expect(html).toContain('Replacement cover completed')
  expect(html).not.toContain('Replacement cover assigned')
})
test('empty attendance never implies zero or perfect attendance', () => {
  const html = renderToStaticMarkup(<AttendanceSummary stats={{ ...stats, completed: 0, missed: 0 }} />)
  expect(html).toContain('No attendance data')
  expect(html).not.toContain('0%')
})
