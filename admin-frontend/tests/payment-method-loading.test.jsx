// Exercise real React Query subscriptions; only the API and Stripe fields are mocked.
import React, { StrictMode, act } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { BillingProfileSection } from '../src/features/billing/components/BillingProfileSection'

const fixture = vi.hoisted(() => ({ setup: vi.fn() }))
vi.mock('../src/features/billing/api', () => ({ billingApi: {
  createSetupIntent: fixture.setup,
  getProfile: async () => ({ name: '', email: '', address: {}, cards: [] }),
} }))
vi.mock('../src/shared/stores/auth', () => ({ useAuthStore: select => select({ user: { id: 'fictional-owner' } }) }))
vi.mock('../src/shared/lib/stripe', () => ({ stripePromise: null, stripeAppearance: {} }))
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children, options }) => <div data-secret={options.clientSecret}>{children}</div>,
  PaymentElement: () => <p>Payment fields rendered</p>,
  useStripe: () => null,
  useElements: () => null,
}))

let root, container, client
const settle = async () => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 25)) }) }
function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
async function render(strict = true) {
  const view = <QueryClientProvider client={client}><BillingProfileSection /></QueryClientProvider>
  await act(async () => { root.render(strict ? <StrictMode>{view}</StrictMode> : view) })
  await settle()
}
async function click(label) {
  const target = [...container.querySelectorAll('button')].find(node => node.textContent === label || node.getAttribute('aria-label') === label)
  expect(target, `Missing button: ${label}`).toBeTruthy()
  await act(async () => target.click())
  await settle()
}
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
  window.history.replaceState({}, '', '/')
  fixture.setup.mockReset()
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  client.clear()
  container.remove()
})

test.each([false, true])('Add new shows payment fields after delayed success; StrictMode=%s', async strict => {
  const request = deferred()
  fixture.setup.mockReturnValue(request.promise)
  await render(strict)
  expect(fixture.setup).not.toHaveBeenCalled()
  await click('Add new')
  expect(fixture.setup).toHaveBeenCalledOnce()
  expect(container.textContent).toContain('Loading secure payment form')
  await act(async () => request.resolve({ client_secret: 'seti_fictional_secret' }))
  await settle()
  expect(client.getMutationCache().getAll()[0].state.status).toBe('success')
  expect(container.textContent).toContain('Payment fields rendered')
  expect(container.textContent).not.toContain('Loading secure payment form')
  expect(fixture.setup).toHaveBeenCalledOnce()
})

test('a failed setup shows an error and retry loads the form in StrictMode', async () => {
  const request = deferred()
  fixture.setup.mockReturnValueOnce(request.promise).mockResolvedValueOnce({ client_secret: 'seti_retry_secret' })
  await render()
  await click('Add new')
  await act(async () => request.reject(new Error('Setup unavailable')))
  await settle()
  expect(container.querySelector('[role=alert]').textContent).toContain('Could not load the form')
  expect(container.textContent).not.toContain('Loading secure payment form')
  await click('Try again')
  expect(container.textContent).toContain('Payment fields rendered')
  expect(fixture.setup).toHaveBeenCalledTimes(2)
})

test('closing and reopening ignores the previous pending result', async () => {
  const oldRequest = deferred(), newRequest = deferred()
  fixture.setup.mockReturnValueOnce(oldRequest.promise).mockReturnValueOnce(newRequest.promise)
  await render()
  await click('Add new')
  await click('Close')
  expect(container.querySelector('dialog')).toBeNull()
  await click('Add new')
  await act(async () => oldRequest.resolve({ client_secret: 'seti_old_secret' }))
  await settle()
  expect(container.textContent).toContain('Loading secure payment form')
  expect(container.querySelector('[data-secret]')).toBeNull()
  await act(async () => newRequest.resolve({ client_secret: 'seti_new_secret' }))
  await settle()
  expect(container.querySelector('[data-secret]').dataset.secret).toBe('seti_new_secret')
  expect(fixture.setup).toHaveBeenCalledTimes(2)
})

test('reopening a loaded form starts a fresh setup', async () => {
  fixture.setup.mockResolvedValueOnce({ client_secret: 'seti_first_secret' }).mockResolvedValueOnce({ client_secret: 'seti_second_secret' })
  await render()
  await click('Add new')
  expect(container.textContent).toContain('Payment fields rendered')
  await click('Close')
  await click('Add new')
  expect(container.querySelector('[data-secret]').dataset.secret).toBe('seti_second_secret')
  expect(fixture.setup).toHaveBeenCalledTimes(2)
})
