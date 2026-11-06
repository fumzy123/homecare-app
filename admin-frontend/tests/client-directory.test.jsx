import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, expect, test, vi } from 'vitest'
import { ClientDirectory } from '../src/features/clients/components/ClientDirectory'
import { useClients } from '../src/features/clients/hooks/useClients'

vi.mock('../src/features/clients/hooks/useClients', () => ({ useClients: vi.fn() }))
vi.mock('../src/features/clients/components/CreateClientDrawer', () => ({ CreateClientDrawer: () => null }))
vi.mock('@tanstack/react-router', () => ({ Link: ({ children, params, to, search, ...props }) => <a {...props} href={`/dashboard/clients/${params.clientId}${to.endsWith('/care-need') ? `/care-need?need=${search.need}` : ''}`}>{children}</a> }))
const care = { weekly_hours: 6, day_count: 2, slot_count: 3, covered_slot_count: 3, state: 'scheduled', starts_on: '2026-10-27', revision_pending: false, scheduled_change_on: null }
const client = (first_name, summary, status = 'active') => ({ id: first_name, first_name, last_name: 'Test', city: "St. John's", street: '101 Demo Lane', date_of_birth: '1944-03-12', status, directory_care: summary })
let root, container
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.clearAllMocks() })
async function render(data, extra = {}) {
  useClients.mockReturnValue({ data, isPending: false, isError: false, refetch: vi.fn(), ...extra })
  await act(async () => root.render(<ClientDirectory />))
}
const row = (name) => [...container.querySelectorAll('tbody tr')].find(el => el.textContent.includes(name))

test('compact rows show hours, slots, coverage, dates, age and street with one profile link', async () => {
  await render([
    client('Eleanor', { ...care, revision_pending: true }),
    client('Arthur', { ...care, weekly_hours: 9, covered_slot_count: 2 }),
    client('Margaret', { ...care, starts_on: '2026-11-02' }),
    client('George', { ...care, state: 'requested', covered_slot_count: 0 }),
  ])
  expect(row('Eleanor').textContent).toContain('6 hours per weekAcross 2 days')
  expect(row('Eleanor').textContent).toContain('Scheduled from Oct 27')
  expect(row('Eleanor').textContent).toContain('Revision pending')
  expect(row('Eleanor').textContent).toContain('3/3 covered')
  expect(row('Arthur').textContent).toContain('1 slot open')
  expect(row('Margaret').textContent).toContain('Scheduled from Nov 2')
  expect(row('George').textContent).toContain('Care requested from Oct 27')
  expect(row('George').textContent).toContain('Unassigned')
  expect(row('Eleanor').querySelectorAll('td')[2].querySelector('small').textContent).toBe('101 Demo Lane')
  expect([...container.querySelectorAll('th')].map(el => el.textContent)).toEqual(['Client', 'Age', 'Location', 'Weekly care', 'Coverage', 'Status'])
  expect(row('Eleanor').querySelectorAll('a')).toHaveLength(1)
  expect(container.textContent).not.toMatch(/years|Not active yet|Awaiting approval/)
  expect(row('Eleanor').querySelector('a').getAttribute('href')).toBe('/dashboard/clients/Eleanor')
})

test('age accounts for whether the birthday has occurred and handles missing birth dates', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 27, 12))
  try {
    await render([
      { ...client('Birthday', null), date_of_birth: '1944-10-27' },
      { ...client('Tomorrow', null), date_of_birth: '1944-10-28' },
      { ...client('Missing', null), date_of_birth: null },
    ])
    expect(row('Birthday').querySelectorAll('td')[1].textContent).toBe('82')
    expect(row('Tomorrow').querySelectorAll('td')[1].textContent).toBe('81')
    expect(row('Missing').querySelectorAll('td')[1].textContent).toBe('—')
  } finally {
    vi.useRealTimers()
  }
})

test('current care has no start date; approved change stays visible', async () => {
  await render([client('Current', { ...care, state: 'current', starts_on: null, scheduled_change_on: '2026-11-02', scheduled_change_id: 'next-revision' })])
  expect(row('Current').textContent).not.toContain('Scheduled from')
  expect(row('Current').textContent).toContain('Upcoming change · Nov 2')
  expect(row('Current').querySelector('.cw-upcoming-link').getAttribute('href')).toBe('/dashboard/clients/Current/care-need?need=next-revision')
})

test('no care, unavailable data and imported coverage remain distinct', async () => {
  await render([client('Empty', null), client('Unknown', undefined), client('Imported', { ...care, covered_slot_count: null })])
  expect(row('Empty').textContent).toContain('Not set up')
  expect(row('Empty').textContent).toContain('No care slots yet')
  expect(row('Unknown').textContent).toContain('Unavailable')
  expect(row('Unknown').textContent).not.toContain('Unassigned')
  expect(row('Imported').textContent).toContain('Imported schedule')
})

test('relationship filter still works and failed requests expose retry instead of empty care', async () => {
  await render([client('Active', care), client('Paused', care, 'on_hold')])
  await act(async () => [...container.querySelectorAll('button')].find(b => b.textContent === 'On hold').click())
  expect(row('Active')).toBeUndefined()
  expect(row('Paused')).toBeDefined()
  await render(undefined, { isError: true })
  expect(container.querySelector('[role="alert"]')).not.toBeNull()
  expect(container.textContent).not.toContain('Not set up')
})


test('one care day is singular even with several slots; missing day counts are not inferred', async () => {
  await render([client('OneDay', { ...care, weekly_hours: 1, day_count: 1 }), client('Legacy', { ...care, day_count: undefined })])
  expect(row('OneDay').textContent).toContain('1 hour per weekOn 1 day')
  expect(row('Legacy').textContent).not.toMatch(/Across|On 1 day/)
})
