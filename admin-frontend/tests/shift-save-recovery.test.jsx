import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ShiftDetailDrawer } from '../src/features/shifts/components/ShiftDetailDrawer'
import { ApiError } from '../src/shared/lib/api-client'

const api = vi.hoisted(() => ({ updateModification: vi.fn(), createModification: vi.fn(), close: vi.fn() }))
vi.mock('../src/shared/lib/api-client', () => ({
  ApiError: class extends Error { constructor(message, code) { super(message); this.code = code } },
}))
vi.mock('../src/features/shifts/hooks/useOvertimeMutations', () => ({ useRequestOvertime: () => ({}) }))
vi.mock('../src/features/shifts/api', () => ({
  shiftsApi: { ...api, getProgressNote: async () => ({ entries: [] }) },
  ORDERED_DAYS: ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'], DAY_LABELS: { WE: 'Wed' },
}))
vi.mock('../src/features/org-members/api', () => ({ orgMembersApi: { listByRole: async () => [] } }))
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
