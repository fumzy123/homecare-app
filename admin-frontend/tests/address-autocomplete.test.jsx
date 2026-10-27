import React, { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AddressAutocomplete } from '../src/features/clients/components/AddressAutocomplete'

const post = vi.hoisted(() => vi.fn())
vi.mock('@/shared/lib/api-client', () => ({ apiClient: { post } }))
globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root, host, queryClient, selected
const suggestion = { label: '100 Demo Road, St. John’s, NL', street: '100 Demo Road', city: 'St. John’s', province: 'NL', postal_code: 'A1A 1A1' }

function Harness() {
  const [value, setValue] = useState('')
  return <AddressAutocomplete value={value} onChange={setValue} onBlur={() => {}}
    onSelect={address => { selected(address); setValue(address.street) }} />
}
beforeEach(async () => {
  vi.useFakeTimers()
  post.mockReset().mockResolvedValue({ data: { suggestions: [suggestion] } })
  selected = vi.fn()
  queryClient = new QueryClient()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => root.render(<QueryClientProvider client={queryClient}><Harness /></QueryClientProvider>))
})
afterEach(async () => {
  await act(async () => root.unmount())
  queryClient.clear()
  host.remove()
  vi.useRealTimers()
})
async function type(value) {
  await act(async () => {
    const input = host.querySelector('input')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
async function tick(ms = 350) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms) })
  await act(async () => { await vi.advanceTimersByTimeAsync(1) })
}
async function key(name) {
  await act(async () => host.querySelector('input').dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true })))
}

test('minimum length and debounce send only the final input; selection does not look up again', async () => {
  await type('10')
  await tick()
  expect(post).not.toHaveBeenCalled()
  await type('100')
  await tick(150)
  await type('100 Demo')
  await tick(348)
  expect(post).not.toHaveBeenCalled()
  await tick(2)
  expect(post).toHaveBeenCalledTimes(1)
  expect(post.mock.calls[0][1]).toEqual({ text: '100 Demo' })
  await key('ArrowDown')
  expect(host.querySelector('input').getAttribute('aria-activedescendant')).toBeTruthy()
  await key('Enter')
  expect(selected).toHaveBeenCalledWith(suggestion)
  expect(host.querySelector('input').value).toBe('100 Demo Road')
  expect(host.querySelector('[role="listbox"]')).toBeNull()
  await tick()
  expect(post).toHaveBeenCalledTimes(1)
})

test('old results disappear immediately and a late response cannot replace current suggestions', async () => {
  let resolveOld
  post.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
  await type('100 Old')
  await tick()
  const signal = post.mock.calls[0][2].signal
  await type('100 New')
  expect(signal.aborted).toBe(true)
  expect(host.querySelector('[role="listbox"]')).toBeNull()
  await tick()
  await act(async () => resolveOld({ data: { suggestions: [{ ...suggestion, label: 'OLD RESULT' }] } }))
  expect(host.textContent).not.toContain('OLD RESULT')
  expect(host.querySelector('[role="option"] strong').textContent).toBe(suggestion.street)
  expect(host.textContent).toContain(suggestion.city)
})

test('provider failure keeps manual text and does not retry automatically', async () => {
  post.mockRejectedValue(new Error('unavailable'))
  await type('100 Demo')
  await tick()
  expect(host.textContent).toContain('enter the address manually')
  expect(host.querySelector('input').value).toBe('100 Demo')
  await tick(10000)
  expect(post).toHaveBeenCalledTimes(1)
})

test('no matches, escape, and mouse selection remain accessible', async () => {
  post.mockResolvedValueOnce({ data: { suggestions: [] } })
  await type('Unknown address')
  await tick()
  expect(host.textContent).toContain('No matching addresses')
  await type('100 Demo')
  await tick()
  await key('Escape')
  expect(host.querySelector('[role="listbox"]')).toBeNull()
  await type('100 Demo Road')
  await tick()
  await act(async () => host.querySelector('[role="option"]').click())
  expect(selected).toHaveBeenCalledWith(suggestion)
  expect(host.querySelector('a[href="https://www.geoapify.com/"]')).not.toBeNull()
})
