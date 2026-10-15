import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, test, vi } from 'vitest'
import { useEmbeddedBilling } from '../src/features/billing/hooks/useEmbeddedBilling'
import { useBillingProfile } from '../src/features/billing/hooks/useBillingProfile'
import { useBillingDetails } from '../src/features/billing/hooks/useBillingOnboarding'

const fixture = vi.hoisted(() => ({ saved: false }))
vi.mock('../src/features/billing/api', () => ({ billingApi: {
  embeddedConfirm: async () => { fixture.saved = true; return { card_saved: true } },
  getProfile: async () => ({ cards: fixture.saved ? [{ id: 'test-card', last4: '4242' }] : [] }),
  getBillingDetails: async () => ({ last4: fixture.saved ? '4242' : null }),
} }))

function BillingScreen() {
  const { confirm } = useEmbeddedBilling()
  const { profile } = useBillingProfile('fixture-owner')
  const details = useBillingDetails('fixture-owner', true)
  return <><button onClick={() => confirm.mutate()}>Finish checkout</button>
    <p>{profile.data?.cards.map(card => card.last4).join(', ') || 'No saved card'}</p>
    <p>Default card: {details.data?.last4 || 'none'}</p></>
}

let root, container, client
afterEach(async () => {
  if (root) await act(async () => root.unmount())
  client?.clear()
  container?.remove()
})

test('checkout replaces a fresh cached empty card profile without a page reload', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  fixture.saved = false
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 300_000 } } })
  client.setQueryData(['billing-profile', 'fixture-owner'], { cards: [] })
  client.setQueryData(['billing-details', 'fixture-owner'], { last4: null })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => root.render(<QueryClientProvider client={client}><BillingScreen /></QueryClientProvider>))
  expect(container.textContent).toContain('No saved card')
  await act(async () => { container.querySelector('button').click(); await new Promise(resolve => setTimeout(resolve, 30)) })
  expect(container.textContent).not.toContain('No saved card')
  expect(container.textContent).toContain('Default card: 4242')
})
