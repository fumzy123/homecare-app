import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ResetPasswordForm } from '../src/features/auth/components/ResetPasswordForm'
import { EmailLinkError } from '../src/features/auth/components/EmailLinkError'

const fixture = vi.hoisted(() => ({ getSession: vi.fn(), getUser: vi.fn(), update: vi.fn(), callback: null }))
vi.mock('../src/shared/lib/supabase', () => ({ supabase: { auth: {
  getSession: fixture.getSession, getUser: fixture.getUser,
  onAuthStateChange: callback => { fixture.callback = callback; return { data: { subscription: { unsubscribe() {} } } } },
} } }))
vi.mock('../src/features/auth/api', () => ({ authApi: { setNewPassword: fixture.update } }))
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(), Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}))

let container, root
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  window.history.replaceState(null, '', '/reset-password')
  fixture.getSession.mockReset().mockResolvedValue({ data: { session: null }, error: null })
  fixture.getUser.mockReset().mockResolvedValue({ data: { user: { id: 'worker' } }, error: null })
  fixture.update.mockReset()
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove() })
async function render(element = <ResetPasswordForm />) { await act(async () => root.render(element)) }
async function enter(input, value) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

test('confirmation revalidates when only the new password changes', async () => {
  fixture.getSession.mockResolvedValue({ data: { session: { user: { id: 'worker' } } }, error: null })
  await render()
  const [password, confirm] = container.querySelectorAll('input')
  await enter(password, 'Fictional-password-one')
  await enter(confirm, 'Fictional-password-two')
  expect(container.textContent).toContain('Passwords do not match')

  await enter(password, 'Fictional-password-two')
  expect(container.textContent).not.toContain('Passwords do not match')
  expect(confirm.value).toBe('Fictional-password-two')

  await enter(password, 'Fictional-password-three')
  expect(container.textContent).toContain('Passwords do not match')
  await act(async () => container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  expect(fixture.update).not.toHaveBeenCalled()
})

test('missing session ends verification and offers a new reset link', async () => {
  await render()
  expect(container.querySelector('[role=alert]').textContent).toContain('missing, expired, or already used')
  expect(container.querySelector('a[href="/forgot-password"]')).toBeTruthy()
  expect(container.querySelector('input')).toBeNull()
})

test('a valid restored identity opens the form even when the recovery event was emitted before mount', async () => {
  fixture.getSession.mockResolvedValue({ data: { session: { user: { id: 'worker' } } }, error: null })
  await render()
  expect(container.querySelectorAll('input[type=password]')).toHaveLength(2)
  expect(fixture.getUser).toHaveBeenCalledOnce()
})

test('a stale session cannot open password entry', async () => {
  fixture.getSession.mockResolvedValue({ data: { session: { user: { id: 'deleted' } } }, error: null })
  fixture.getUser.mockResolvedValue({ data: { user: null }, error: new Error('User deleted') })
  await render()
  expect(container.querySelector('[role=alert]')).toBeTruthy()
  expect(container.querySelector('input')).toBeNull()
})

test('an expired-link error is handled even with a previously saved session', async () => {
  window.history.replaceState(null, '', '/reset-password#error=access_denied&error_code=otp_expired')
  fixture.getSession.mockResolvedValue({ data: { session: { user: { id: 'worker' } } }, error: null })
  await render()
  expect(container.querySelector('[role=alert]')).toBeTruthy()
  expect(container.querySelector('input')).toBeNull()
})

test('sign-out removes password entry from an open reset screen', async () => {
  fixture.getSession.mockResolvedValue({ data: { session: { user: { id: 'worker' } } }, error: null })
  await render()
  await act(async () => fixture.callback('SIGNED_OUT', null))
  expect(container.querySelector('input')).toBeNull()
  expect(container.textContent).toContain('recovery session has ended')
})

test('the rejected email-link landing provides recovery, confirmation, invitation and sign-in paths', async () => {
  await render(<EmailLinkError />)
  expect([...container.querySelectorAll('a')].map(a => a.getAttribute('href'))).toEqual([
    '/forgot-password', '/confirm-email', '/accept-invite', '/login',
  ])
})
