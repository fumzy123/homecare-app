import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, expect, test, vi } from 'vitest'
import { RevisionAssignments } from '../src/features/assignments/components/RevisionAssignments'
import { assignmentEnd, revisionAssignments } from '../src/features/assignments/lib/revisionAssignments'
import { assignmentRows, currentRevision, nextRevision, proposal, revisions } from './assigned-workers-fixtures'

let root, container
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container) })
afterEach(async () => { await act(async () => root.unmount()); container.remove() })
const project = (revision = currentRevision, rows = assignmentRows, today = '2026-11-09') => revisionAssignments(revision, rows, today, revisions)
async function render(revision = currentRevision, rows = assignmentRows, onManage = vi.fn()) {
  await act(async () => root.render(<RevisionAssignments revision={revision} revisions={revisions} rows={rows} today="2026-11-09" onManage={onManage} />))
}

test('scopes by immutable slot and client IDs, counts each slot once and connects an approved revision', () => {
  const view = project(currentRevision, [...assignmentRows, { ...assignmentRows[0], id: 'foreign', client_id: 'other' }])
  expect(view.assignments.map(a => a.id)).toEqual(['alex', 'casey', 'jordan', 'morgan'])
  expect(view.covered).toBe(3)
  expect(view.successor.id).toBe(nextRevision.id)
  expect(view.slots[2].visible.map(a => a.worker_name)).toEqual(['Jordan Demo', 'Morgan Demo'])
  expect(assignmentEnd(assignmentRows[2], currentRevision)).toBe('2026-11-12')
})

test('replacement cutoff is exclusive and a gap is not counted as covered', () => {
  expect(project(currentRevision, assignmentRows, '2026-11-13').slots[2].visible.map(a => a.id)).toEqual(['morgan'])
  const gap = assignmentRows.map(a => a.id === 'morgan' ? { ...a, starts_on: '2026-11-20' } : a)
  expect(project(currentRevision, gap, '2026-11-13').covered).toBe(2)
})

test('future approval uses its start; proposals never borrow existing workers or imply approval', async () => {
  expect(project(nextRevision).asOf).toBe('2026-11-23')
  expect(project(nextRevision).covered).toBe(2)
  await render(proposal)
  expect(container.textContent).toContain('Proposed · Not scheduled')
  expect(container.textContent).not.toContain('Alex Demo')
  expect(container.textContent).not.toContain('Approved revision')
})

test('replaced-before-start and zero-length assignments stay in history without becoming coverage', () => {
  const replaced = { ...nextRevision, ends_on: '2026-11-22' }
  expect(project(replaced).replaced).toBe(true)
  expect(project(replaced).covered).toBe(0)
  expect(project(replaced).assignments).toHaveLength(2)
  const stopped = assignmentRows.map(a => a.id === 'morgan' ? { ...a, stops_from: a.starts_on } : a)
  expect(project(currentRevision, stopped, '2026-11-13').covered).toBe(2)
})

test('historical revision shows end-of-revision coverage and retains previous workers', async () => {
  const view = project(currentRevision, assignmentRows, '2026-12-01')
  expect(view.asOf).toBe('2026-11-22')
  expect(view.slots[2].visible.map(a => a.id)).toEqual(['morgan'])
  expect(view.slots[2].history.map(a => a.id)).toEqual(['jordan', 'morgan'])
  await render()
  const friday = container.querySelector('article[aria-label^="Friday"]')
  expect(friday.textContent).toContain('Jordan Demo')
  expect(friday.textContent).toContain('Morgan Demo')
  expect(container.querySelector('details').open).toBe(false)
  expect(container.querySelector('details').textContent).toContain('Scheduled change')
  expect(container.querySelector('details').textContent).toContain('Morgan taking over Friday coverage.')
})

test('manage action retains multi-slot selection for one worker and request only', async () => {
  const manage = vi.fn()
  await render(nextRevision, assignmentRows, manage)
  await act(async () => container.querySelector('button').click())
  expect(manage.mock.calls[0][0].map(a => a.id)).toEqual(['next-alex', 'next-alex-friday'])
})

test('missing assignments and imported records do not invent coverage', async () => {
  await render(currentRevision, [])
  expect(container.textContent).toContain('0/3 slots covered')
  expect(container.querySelectorAll('.aw-unassigned')).toHaveLength(3)
  await render({ ...currentRevision, imported: true }, [])
  expect(container.textContent).toContain('Imported schedules may not have linked')
  expect(container.textContent).not.toContain('0/3 slots covered')
})

test('cancelled-before-start coverage retains its dates but is not described as a predecessor', async () => {
  const rows = assignmentRows.map(row => row.id === 'jordan' ? { ...row, stops_from: row.starts_on } : row)
  await render(currentRevision, rows)
  expect(container.querySelector('.aw-changes').textContent).not.toContain('Jordan Demo →')
  expect(container.querySelector('details').textContent).toContain('Scheduled from Oct 26, 2026; ended Oct 25, 2026 before starting.')
})
