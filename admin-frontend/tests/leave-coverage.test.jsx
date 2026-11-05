import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test, vi } from 'vitest'
import { RecordLeaveModal } from '../src/features/workers/components/RecordLeaveModal'

vi.mock('../src/features/attention/hooks/useUnsavedChanges', () => ({ useUnsavedChanges: () => {} }))
vi.mock('../src/features/workers/components/WorkerProfileUI', () => ({ WorkerDialog: ({ children }) => <div>{children}</div> }))
vi.mock('../src/features/workers/hooks/useWorkerProfile', () => ({ useReviewWorkerLeave: () => ({
  isPending: false, mutate: (_payload, options) => options.onSuccess({ review_token: 'reviewed', protected_count: 1,
    visits: [{ shift_id: 'visit', occurrence_date: '2026-12-14', client: 'Jane', start_time: '2026-12-14T10:00:00', end_time: '2026-12-14T12:00:00' }] }),
}) }))
async function mounted(element, run) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  try { await act(async () => root.render(element)); await run(container) }
  finally { await act(async () => root.unmount()); container.remove() }
}
async function setInput(input, value) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

test('leave requires a review, shows impacted and protected visits, and invalidates review on date changes', async () => {
  const submit = vi.fn()
  await mounted(<RecordLeaveModal workerId="worker" onClose={() => {}} onSubmit={submit} isPending={false} error={null} />, async c => {
    const dates = c.querySelectorAll('input[type=date]')
    await setInput(dates[0], '2026-12-14'); await setInput(dates[1], '2026-12-14')
    await act(async () => c.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    expect(submit).not.toHaveBeenCalled()
    expect(c.textContent).toContain('1 visits need replacement coverage')
    expect(c.textContent).toContain('documented visits will retain their history')
    await act(async () => c.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ review_token: 'reviewed' }))
    await setInput(dates[1], '2026-12-15')
    expect(c.textContent).toContain('Review affected visits')
    expect(c.querySelector('[aria-label="Affected visits"]')).toBeNull()
  })
})
