import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ShiftDetailDrawer } from '../src/features/shifts/components/ShiftDetailDrawer'
import { ApiError } from '../src/shared/lib/api-client'

const api = vi.hoisted(() => ({ replaceDroppedVisit: vi.fn(), updateModification: vi.fn(), createModification: vi.fn(), close: vi.fn() }))
vi.mock('../src/shared/lib/api-client', () => ({
  ApiError: class extends Error { constructor(message, code) { super(message); this.code = code } },
}))
vi.mock('../src/features/shifts/hooks/useOvertimeMutations', () => ({ useRequestOvertime: () => ({}) }))
vi.mock('../src/features/shifts/api', () => ({
  shiftsApi: { ...api, getProgressNote: async () => ({ entries: [] }) },
  ORDERED_DAYS: ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'], DAY_LABELS: { WE: 'Wed' },
}))
vi.mock('../src/features/org-members/api', () => ({ orgMembersApi: { listByRole: async () => [{ id: 'cover', first_name: 'Blue', last_name: 'Oak' }, { id: 'other', first_name: 'Other', last_name: 'Worker' }] } }))
vi.mock('../src/features/clients/api', () => ({ clientsApi: { listClients: async () => [] } }))

const shift = {
  shift_id: 'test-shift', date: '2026-10-28', start_time: '2026-10-28T13:00:00', end_time: '2026-10-28T15:00:00',
  worker: { id: 'worker', first_name: 'Sam', last_name: 'Demo' }, client: { id: 'client', first_name: 'Test', last_name: 'Client' },
  is_recurring: true, is_modification: true, recurrence_frequency: 'weekly', recurrence_days_of_week: ['WE'],
  completion_status: 'scheduled', notes: 'Draft note to retain',
}
let root, container, qc
const settle = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) })
const button = text => [...container.querySelectorAll('button')].find(el => el.textContent.trim() === text)
async function click(text) { await act(async () => button(text).click()); await settle() }
beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
  vi.clearAllMocks()
  api.updateModification.mockResolvedValue(undefined)
  onlineManager.setOnline(true)
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  container = document.createElement('div'); document.body.append(container)
  root = createRoot(container)
  await act(async () => root.render(<QueryClientProvider client={qc}><ShiftDetailDrawer shift={shift} onClose={api.close} /></QueryClientProvider>))
  await settle()
  await click('Edit')
})
afterEach(async () => {
  await act(async () => { root.unmount(); onlineManager.setOnline(true) })
  container.remove(); qc.clear()
})

test('offline recurring save keeps the draft, never resumes automatically, then retries only this occurrence', async () => {
  await click('Save Changes')
  await act(async () => onlineManager.setOnline(false))
  await click('Save')
  expect(container.querySelector('[role="alert"]').textContent).toContain("Your changes haven't been sent")
  expect(container.querySelector('textarea').value).toBe('Draft note to retain')
  expect(api.updateModification).not.toHaveBeenCalled()
  await act(async () => onlineManager.setOnline(true))
  await settle()
  expect(api.updateModification).not.toHaveBeenCalled()
  await click('Retry save')
  await click('Save')
  expect(api.updateModification).toHaveBeenCalledExactlyOnceWith('test-shift', '2026-10-28', expect.objectContaining({ notes: 'Draft note to retain' }))
  expect(api.createModification).not.toHaveBeenCalled()
})

test('failed request retains the draft and permits an explicit retry without duplicate submissions', async () => {
  api.updateModification.mockRejectedValueOnce(new ApiError('Network Error', 'ERR_NETWORK'))
  await click('Save Changes'); await click('Save')
  expect(container.querySelector('[role="alert"]').textContent).toContain("couldn't confirm the save")
  expect(container.querySelector('textarea').value).toBe('Draft note to retain')
  let finish
  api.updateModification.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  await click('Retry save'); await click('Save')
  expect(button('Cancel').disabled).toBe(true)
  expect(button('Discard').disabled).toBe(true)
  expect([...container.querySelectorAll('button')].filter(el => el.textContent === 'Saving…').every(el => el.disabled)).toBe(true)
  await act(async () => button('Cancel').click())
  expect(api.updateModification).toHaveBeenCalledTimes(2)
  await act(async () => finish()); await settle()
  expect(container.textContent).toContain('Visit details')
})

test('discard after an offline failure leaves nothing queued for reconnection', async () => {
  await act(async () => onlineManager.setOnline(false))
  await click('Save Changes'); await click('Save'); await click('Discard')
  await act(async () => onlineManager.setOnline(true)); await settle()
  expect(api.updateModification).not.toHaveBeenCalled()
  expect(container.textContent).toContain('Visit details')
})

async function openReplacement() {
  await act(async () => root.render(<QueryClientProvider client={qc}><ShiftDetailDrawer key="dropped" shift={{ ...shift, completion_status: 'dropped', dropped_reason: 'Worker on leave' }} onClose={api.close} /></QueryClientProvider>))
  await settle()
  expect(container.textContent).toContain('Needs replacement')
  expect(container.querySelector('select')).toBeNull()
  await click('Edit')
  expect(container.textContent).toContain('This visit only')
  expect(container.textContent).not.toContain('Repeat settings')
}
async function chooseCover(id = 'cover') {
  await act(async () => {
    const select = container.querySelector('#replacement-worker')
    select.value = id; select.dispatchEvent(new Event('change', { bubbles: true }))
  })
}
test('replacement is edited through Edit, requires confirmation, and saves only this occurrence', async () => {
  await openReplacement()
  expect(button('Save Changes').disabled).toBe(true)
  await chooseCover()
  expect(button('Save Changes').disabled).toBe(true)
  await act(async () => container.querySelector('input[type=checkbox]').click())
  await chooseCover('other')
  expect(button('Save Changes').disabled).toBe(true)
  await act(async () => container.querySelector('input[type=checkbox]').click())
  await click('Save Changes')
  expect(api.replaceDroppedVisit).toHaveBeenCalledExactlyOnceWith('test-shift', '2026-10-28', 'other')
  expect(api.updateModification).not.toHaveBeenCalled()
  expect(api.close).toHaveBeenCalledOnce()
})
test('replacement offline failure retains selection and requires explicit retry after reconnect', async () => {
  await openReplacement(); await chooseCover()
  await act(async () => container.querySelector('input[type=checkbox]').click())
  await act(async () => onlineManager.setOnline(false))
  await click('Save Changes')
  expect(container.querySelector('[role="alert"]').textContent).toContain("Your changes haven't been sent")
  expect(container.querySelector('#replacement-worker').value).toBe('cover')
  await act(async () => onlineManager.setOnline(true)); await settle()
  expect(api.replaceDroppedVisit).not.toHaveBeenCalled()
  await click('Retry save')
  expect(api.replaceDroppedVisit).toHaveBeenCalledExactlyOnceWith('test-shift', '2026-10-28', 'cover')
})
test('replacement eligibility failures preserve the editor without offering an unsupported override', async () => {
  await openReplacement(); await chooseCover()
  await act(async () => container.querySelector('input[type=checkbox]').click())
  api.replaceDroppedVisit.mockRejectedValueOnce(new ApiError('Worker is on leave', 'WORKER_ALREADY_SCHEDULED_AT_THIS_TIME_BLOCK'))
  await click('Save Changes')
  expect(container.querySelector('[role="alert"]').textContent).toContain('Worker is on leave')
  expect(container.querySelector('#replacement-worker').value).toBe('cover')
  expect(api.close).not.toHaveBeenCalled()
  await click('Discard'); await click('Edit')
  expect(container.querySelector('#replacement-worker').value).toBe('')
  expect(button('Save Changes').disabled).toBe(true)
})
