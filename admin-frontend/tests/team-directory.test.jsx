import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { TeamSection } from '../src/features/settings/components/TeamSection'
import { orgMembersApi } from '../src/features/org-members/api'
import { invitationsApi } from '../src/features/invitations/api'

vi.mock('../src/features/org-members/api', () => ({
  orgMembersApi: { listByRole: vi.fn() }, EMPLOYMENT_TYPE_LABELS: { full_time: 'Full-time', part_time: 'Part-time' },
}))
vi.mock('../src/features/invitations/api', () => ({ invitationsApi: { listInvitations: vi.fn(), revokeInvitation: vi.fn(), resendInvitation: vi.fn() } }))
vi.mock('../src/features/invitations/components/InviteModal', () => ({ InviteModal: () => null }))

const owner = { id: 'owner', first_name: 'Test', last_name: 'Owner', email: 'owner@example.test', role: 'owner', is_active: true }
const supervisor = { id: 'supervisor', first_name: 'Accepted', last_name: 'Supervisor', email: 'supervisor@example.test', role: 'supervisor', is_active: true, phone_number: '+17095551234', employment_type: 'full_time', hire_date: '2026-10-23' }
const manager = { id: 'manager', first_name: 'Inactive', last_name: 'Manager', email: 'manager@example.test', role: 'manager', is_active: false }
const invite = (id, role = 'supervisor', expired = false) => ({ id, email: `${id}@example.test`, role, expires_at: expired ? '2020-01-01' : '2099-01-01' })
let container, root, client, members, invitations
async function settle() { await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)) }) }
async function click(button) { await act(async () => button.click()); await settle() }
function button(label) { return [...container.querySelectorAll('button')].find(el => (el.getAttribute('aria-label') || el.textContent).includes(label)) }
function panel(index) { return container.querySelector(`#team-panel-${index}`) }
async function render() { await act(async () => root.render(<QueryClientProvider client={client}><TeamSection /></QueryClientProvider>)); await settle() }

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  members = [owner, supervisor, manager]
  invitations = [invite('pending'), invite('expired', 'nurse', true), invite('worker', 'home_support_worker')]
  orgMembersApi.listByRole.mockImplementation(async role => members.filter(member => member.role === role))
  invitationsApi.listInvitations.mockImplementation(async () => [...invitations])
  invitationsApi.revokeInvitation.mockImplementation(async id => { invitations = invitations.filter(inv => inv.id !== id) })
  invitationsApi.resendInvitation.mockImplementation(async id => { invitations = invitations.map(inv => inv.id === id ? { ...inv, expires_at: '2099-01-01' } : inv) })
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount()); container.remove(); client.clear(); focusManager.setFocused(undefined); vi.clearAllMocks()
})

test('joined staff is the default, with owners separate, roles, inactive status and profile details', async () => {
  await render()
  expect(button('Staff members').getAttribute('aria-selected')).toBe('true')
  expect(panel(0).textContent).toContain('Accepted Supervisor')
  expect(panel(0).textContent).toContain('Inactive Manager')
  expect(panel(0).textContent).not.toContain('Test Owner')
  expect(panel(0).textContent.toLowerCase()).toContain('inactive')
  expect(container.querySelector('section').textContent).toContain('Test Owner')
  await click(button('View profile for Accepted Supervisor'))
  const profile = container.querySelector('#team-profile-supervisor')
  expect(profile.hidden).toBe(false)
  expect(profile.textContent).toContain('+17095551234')
  expect(profile.textContent).toContain('Full-time')
  expect(profile.textContent).toContain('Oct 23, 2026')
  await click(button('Hide profile for Accepted Supervisor'))
  expect(profile.hidden).toBe(true)
})

test('pending and expired staff invites retain resend/revoke, worker invitations are excluded, tabs support keyboard', async () => {
  await render()
  await act(async () => button('Staff members').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })))
  expect(button('Pending invitations').getAttribute('aria-selected')).toBe('true')
  expect(document.activeElement).toBe(button('Pending invitations'))
  expect(panel(1).hidden).toBe(false)
  expect(panel(1).textContent).toContain('expired@example.test')
  expect(panel(1).textContent).toContain('Expired')
  expect(panel(1).textContent).not.toContain('worker@example.test')
  await click(button('Resend invite to expired@example.test'))
  expect(invitationsApi.resendInvitation).toHaveBeenCalledWith('expired', expect.anything())
  expect(panel(1).textContent).not.toContain('Expired')
  await click(button('Revoke invite to pending@example.test'))
  expect(panel(1).textContent).not.toContain('pending@example.test')
})

test('returning to the page refreshes acceptance in both tabs without changing the selected tab', async () => {
  members = [owner]; invitations = [invite('supervisor')]
  await render()
  await click(button('Pending invitations'))
  await act(async () => focusManager.setFocused(false))
  members = [owner, supervisor]; invitations = []
  await act(async () => focusManager.setFocused(true)); await settle()
  expect(button('Pending invitations').getAttribute('aria-selected')).toBe('true')
  expect(panel(1).textContent).toContain('No pending invitations.')
  await click(button('Staff members'))
  expect(panel(0).querySelectorAll('tbody tr:not([hidden])')).toHaveLength(1)
  expect(panel(0).textContent).toContain('Accepted Supervisor')
  expect(container.querySelectorAll('caption')[0].textContent).toBe('Organization owners')
})

test('loading and failed requests are not presented as an empty team; retry recovers', async () => {
  let rejectStaff
  orgMembersApi.listByRole.mockImplementation(role => role === 'owner' ? Promise.resolve([owner]) : new Promise((resolve, reject) => { rejectStaff = reject }))
  await render()
  expect(panel(0).textContent).toContain('Loading staff members')
  expect(panel(0).textContent).not.toContain('No staff members')
  await act(async () => rejectStaff(new Error('Unavailable'))); await settle()
  expect(panel(0).querySelector('[role="alert"]').textContent).toContain("Couldn't refresh staff members")
  expect(panel(0).textContent).not.toContain('No staff members')
  orgMembersApi.listByRole.mockImplementation(async role => members.filter(member => member.role === role))
  await click(button('Try again'))
  expect(panel(0).textContent).toContain('Accepted Supervisor')
})
