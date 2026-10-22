import React, { StrictMode, act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ConfirmEmailForm } from '../src/features/auth/components/ConfirmEmailForm'

const fixture = vi.hoisted(() => ({
  user: null, getSession: vi.fn(), getUser: vi.fn(), refresh: vi.fn(), register: vi.fn(),
  accept: vi.fn(), navigate: vi.fn(), setAuth: vi.fn(), setTermsAccepted: vi.fn(),
}))
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => fixture.navigate, Link: ({ children }) => <span>{children}</span> }))
vi.mock('../src/shared/lib/supabase', () => ({ supabase: { auth: {
  getSession: fixture.getSession, getUser: fixture.getUser, refreshSession: fixture.refresh,
} } }))
vi.mock('../src/shared/stores/auth', () => ({ useAuthStore: { getState: () => ({ setAuth: fixture.setAuth, setTermsAccepted: fixture.setTermsAccepted }) } }))
vi.mock('../src/shared/lib/legal', () => ({ CURRENT_TERMS_VERSION: 'test-terms', legalApi: { acceptTerms: fixture.accept } }))
vi.mock('../src/features/auth/api', () => ({ authApi: { registerOrganization: fixture.register } }))
vi.mock('../src/features/auth/components/VerificationNotice', () => ({ VerificationNotice: () => <p>Check your email</p> }))

let root, container
const profile = { organization_name: 'Fictional Care', first_name: 'Test', last_name: 'Owner', agency_timezone: 'America/St_Johns' }
const pending = { org_name: profile.organization_name, first_name: profile.first_name, last_name: profile.last_name,
  agency_timezone: profile.agency_timezone, email: 'owner@example.test', terms_version: 'test-terms' }
const session = user => ({ access_token: 'fictional-token', user })
const settle = async () => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) }) }
async function render() {
  await act(async () => root.render(<StrictMode><ConfirmEmailForm /></StrictMode>))
  await settle()
}
async function submit() {
  await act(async () => container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  await settle()
}
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.resetAllMocks()
  localStorage.clear()
  localStorage.setItem('pending_registration', JSON.stringify(pending))
  window.history.replaceState({}, '', '/confirm-email')
  fixture.user = { id: 'test-owner', email: pending.email, email_confirmed_at: '2026-10-15T12:00:00Z', user_metadata: { registration: { ...profile } } }
  fixture.getSession.mockImplementation(async () => ({ data: { session: session(fixture.user) }, error: null }))
  fixture.getUser.mockImplementation(async () => ({ data: { user: fixture.user }, error: null }))
  fixture.refresh.mockImplementation(async () => ({ data: { session: session({ ...fixture.user, user_metadata: { role: 'owner', org_id: 'test-agency' } }) }, error: null }))
  fixture.register.mockResolvedValue({ org_id: 'test-agency' })
  fixture.accept.mockResolvedValue({ accepted: true })
  fixture.navigate.mockResolvedValue(undefined)
  container = document.createElement('div'); document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); localStorage.clear() })

test('verified signup automatically finishes exactly once under StrictMode', async () => {
  let finish
  fixture.register.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  await render()
  expect(container.textContent).toContain('Email verified. Finishing your agency setup')
  expect(container.querySelector('form')).toBeNull()
  expect(fixture.register).toHaveBeenCalledExactlyOnceWith(profile)
  expect(fixture.navigate).not.toHaveBeenCalled()
  await act(async () => finish({ org_id: 'test-agency' }))
  await settle()
  expect(fixture.accept).toHaveBeenCalledExactlyOnceWith('test-terms')
  expect(fixture.navigate).toHaveBeenCalledExactlyOnceWith({ to: '/dashboard' })
  expect(localStorage.getItem('pending_registration')).toBeNull()
})

test.each(['absent', 'wrong email', 'old terms', 'malformed'])('requires consent when local acceptance is %s', async reason => {
  if (reason === 'absent') localStorage.removeItem('pending_registration')
  if (reason === 'wrong email') localStorage.setItem('pending_registration', JSON.stringify({ ...pending, email: 'someone-else@example.test' }))
  if (reason === 'old terms') localStorage.setItem('pending_registration', JSON.stringify({ ...pending, terms_version: 'old' }))
  if (reason === 'malformed') localStorage.setItem('pending_registration', '{invalid')
  await render()
  expect(fixture.register).not.toHaveBeenCalled()
  expect(container.querySelector('input[type=checkbox]').checked).toBe(false)
  expect(container.querySelector('button[type=submit]') ?? container.querySelector('form > button')).toHaveProperty('disabled', true)
  await act(async () => container.querySelector('input[type=checkbox]').click())
  await submit()
  expect(fixture.register).toHaveBeenCalledExactlyOnceWith(profile)
  expect(fixture.navigate).toHaveBeenCalledOnce()
})

test('an unverified account cannot create an agency or accept terms', async () => {
  fixture.user.email_confirmed_at = null
  await render()
  expect(container.textContent).toContain('Check your email')
  expect(fixture.register).not.toHaveBeenCalled()
  expect(fixture.accept).not.toHaveBeenCalled()
})

test('an expired link does not use a previously signed-in session to finish setup', async () => {
  window.history.replaceState({}, '', '/confirm-email#error=access_denied&error_code=otp_expired')
  await render()
  expect(container.textContent).toContain('expired or is invalid')
  expect(fixture.register).not.toHaveBeenCalled()
})

test('missing saved timezone requires review instead of silently using the device timezone', async () => {
  delete fixture.user.user_metadata.registration.agency_timezone
  localStorage.setItem('pending_registration', JSON.stringify({ ...pending, agency_timezone: undefined }))
  await render()
  expect(fixture.register).not.toHaveBeenCalled()
  expect(container.querySelector('form')).not.toBeNull()
})

test('incomplete profile requires review', async () => {
  fixture.user.user_metadata.registration.first_name = ''
  await render()
  expect(fixture.register).not.toHaveBeenCalled()
  expect(container.querySelector('form')).not.toBeNull()
})

test('failed automatic setup retains signup details and allows an explicit retry', async () => {
  fixture.register.mockRejectedValueOnce(new Error('Temporarily unavailable'))
  await render()
  expect(container.textContent).toContain('Temporarily unavailable')
  expect(localStorage.getItem('pending_registration')).not.toBeNull()
  expect(fixture.accept).not.toHaveBeenCalled()
  await submit()
  expect(fixture.register).toHaveBeenCalledTimes(2)
  expect(fixture.navigate).toHaveBeenCalledOnce()
})

test('terms-recording failure preserves consent and prevents dashboard navigation until retry succeeds', async () => {
  fixture.accept.mockRejectedValueOnce(new Error('Could not record terms'))
  await render()
  expect(fixture.navigate).not.toHaveBeenCalled()
  expect(localStorage.getItem('pending_registration')).not.toBeNull()
  await submit()
  expect(fixture.navigate).toHaveBeenCalledOnce()
  expect(localStorage.getItem('pending_registration')).toBeNull()
})

test('changed session cannot create an agency for another account', async () => {
  fixture.getSession.mockResolvedValueOnce({ data: { session: session(fixture.user) }, error: null })
    .mockResolvedValueOnce({ data: { session: session(fixture.user) }, error: null })
    .mockResolvedValue({ data: { session: session({ ...fixture.user, id: 'different-user' }) }, error: null })
  await render()
  expect(container.textContent).toContain('Your session changed')
  expect(fixture.register).not.toHaveBeenCalled()
})
