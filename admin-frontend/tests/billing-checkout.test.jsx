// Component integration tests: no browser, network, credentials, or real charges.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { UpgradeBilling } from '../src/features/billing/components/UpgradeBilling'
import { BillingOverview } from '../src/features/billing/components/BillingOverview'
import { BillingOnboardingPanel } from '../src/features/billing/components/BillingOnboardingPanel'

const fixture = vi.hoisted(() => ({ status: {}, outcome: 'incomplete', decline: false,
  confirm: vi.fn(), setup: vi.fn(), pay: vi.fn(), getStatus: vi.fn() }))
vi.mock('../src/features/billing/api', () => ({ billingApi: {
  getStatus: fixture.getStatus, embeddedSetup: fixture.setup, embeddedConfirm: fixture.confirm,
} }))
vi.mock('../src/shared/stores/auth', () => ({ useAuthStore: select => select({ user: { id: 'owner', role: 'owner' } }) }))
vi.mock('@tanstack/react-router', () => ({ Link: ({ children }) => <span>{children}</span>, useNavigate: () => vi.fn() }))
vi.mock('../src/shared/lib/api-client', () => ({ ApiError: class extends Error {} }))
vi.mock('../src/shared/lib/stripe', () => ({ stripePromise: null, stripeAppearance: {} }))
vi.mock('../src/features/billing/hooks/useBillingOnboarding', () => ({ useBillingOnboarding: () => ({
  options: { data: { consent_version: 'fixture', consent_text: 'I agree to billing', plans: [
    { interval: 'month', base_amount_cents: 35000 },
  ] } }, cancel: { mutate: vi.fn() },
}) }))
vi.mock('../src/features/billing/components/SubscriptionPlans', () => ({ SubscriptionPlans: () => <p>Monthly plan</p> }))
vi.mock('../src/features/billing/components/CompareBillingPlans', () => ({ CompareBillingPlans: ({ status }) => <p>Manage {status.subscription_status} subscription</p> }))
vi.mock('../src/features/billing/components/BillingUsageSection', () => ({ BillingUsageSection: () => null }))
vi.mock('../src/features/billing/components/BillingPaymentSummary', () => ({ BillingPaymentCard: () => null }))
vi.mock('../src/features/billing/components/BillingHistorySection', () => ({ BillingUsageHistorySection: () => null, InvoiceHistorySection: () => null }))
vi.mock('../src/features/billing/components/BillingProfileSection', () => ({ BillingProfileSection: () => null }))
vi.mock('../src/features/billing/components/UpcomingBillingSection', () => ({ UpcomingBillingSection: () => null }))
vi.mock('@stripe/react-stripe-js', async () => {
  const { createContext, useContext } = await import('react')
  const Checkout = createContext(null)
  return {
    EmbeddedCheckoutProvider: ({ options, children }) => <Checkout.Provider value={options}>{children}</Checkout.Provider>,
    EmbeddedCheckout: () => { const options = useContext(Checkout); return <button onClick={options.onComplete}>Save test card</button> },
    Elements: ({ children }) => children,
    PaymentElement: () => <p>Test payment form</p>,
    useStripe: () => ({ confirmPayment: fixture.pay }),
    useElements: () => ({}),
  }
})

let root, container, client
async function settle() {
  // Let React Query's scheduled notifications finish inside React's act boundary.
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 25)) })
}
async function render(element = <UpgradeBilling />) {
  await act(async () => root.render(<QueryClientProvider client={client}>{element}</QueryClientProvider>))
  await settle()
}
async function click(label) {
  const target = [...container.querySelectorAll('button')].find(node => node.textContent === label || node.getAttribute('aria-label') === label)
  expect(target, `Missing button: ${label}`).toBeTruthy()
  await act(async () => target.click())
  await settle()
}
async function startCheckout() {
  await render()
  await act(async () => container.querySelector('input[type=checkbox]').click())
  await click('Continue')
}
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
  window.history.replaceState({}, '', '/')
  fixture.status = { subscription_status: null, is_trial_active: false, trial_days_left: 0,
    trial_ends_at: null, billing_timezone: 'America/St_Johns', new_billing_flow: true }
  fixture.outcome = 'incomplete'
  fixture.decline = false
  fixture.getStatus.mockReset().mockImplementation(async () => ({ ...fixture.status }))
  fixture.setup.mockReset().mockResolvedValue({ client_secret: 'cs_fictional_secret' })
  fixture.confirm.mockReset().mockImplementation(async () => {
    fixture.status = { ...fixture.status, subscription_status: fixture.outcome, card_saved: true }
    return fixture.outcome === 'incomplete' ? { payment_client_secret: 'pi_fictional_secret' } : { card_saved: true }
  })
  fixture.pay.mockReset().mockImplementation(async () => {
    if (fixture.decline) return { error: { message: 'Your test card was declined.' } }
    fixture.outcome = 'active'
    return { paymentIntent: { status: 'succeeded' } }
  })
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  container = document.createElement('div'); document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  client.clear(); container.remove()
})

test('expired trial: card setup continues to payment despite the incomplete status refresh', async () => {
  await startCheckout()
  await click('Save test card')
  expect(container.textContent).toContain('Complete payment')
  expect(container.textContent).not.toContain('Manage incomplete subscription')
  expect(fixture.pay).not.toHaveBeenCalled()
  client.setQueryData(['billing-invoices', 'owner'], { status: 'open' })
  await click('Pay and subscribe')
  expect(fixture.pay).toHaveBeenCalledOnce()
  expect(container.textContent).toContain('Manage active subscription')
  expect(container.querySelector('dialog')).toBeNull()
  expect(fixture.setup).toHaveBeenCalledOnce()
  expect(client.getQueryState(['billing-invoices', 'owner']).isInvalidated).toBe(true)
})

test('payment submission alone never shows active before the backend confirms it', async () => {
  await startCheckout(); await click('Save test card')
  fixture.pay.mockResolvedValue({ paymentIntent: { status: 'processing' } })
  await click('Pay and subscribe')
  expect(container.textContent).not.toContain('Manage active subscription')
  expect(container.textContent).toContain('your first payment is not complete')
  fixture.outcome = 'active'
  await click('Check payment status / finish payment')
  expect(container.textContent).toContain('Manage active subscription')
})

test('webhook refresh during card setup does not unmount checkout', async () => {
  await startCheckout()
  fixture.status = { ...fixture.status, subscription_status: 'incomplete' }
  await act(async () => { await client.invalidateQueries({ queryKey: ['billing-status'] }) })
  await settle()
  expect(container.textContent).toContain('Save test card')
  await click('Save test card')
  expect(container.textContent).toContain('Pay and subscribe')
})

test('declined payment stays in checkout and can retry without creating another subscription', async () => {
  await startCheckout(); await click('Save test card')
  fixture.decline = true
  await click('Pay and subscribe')
  expect(container.textContent).toContain('Your test card was declined.')
  expect(container.textContent).not.toContain('Manage active subscription')
  fixture.decline = false
  await click('Pay and subscribe')
  expect(container.textContent).toContain('Manage active subscription')
  expect(fixture.setup).toHaveBeenCalledOnce()
})

test('remaining trial: saving the card leaves the trial intact without requesting payment', async () => {
  fixture.status = { ...fixture.status, is_trial_active: true, trial_days_left: 5, trial_ends_at: '2026-10-19T16:00:00Z' }
  fixture.outcome = 'trialing'
  await startCheckout()
  expect(container.textContent).toContain('Nothing due today')
  await click('Save test card')
  expect(container.textContent).toContain('Manage trialing subscription')
  expect(fixture.status.trial_days_left).toBe(5)
  expect(fixture.pay).not.toHaveBeenCalled()
})

test('closing unpaid checkout leaves an explicit incomplete state and a resume action', async () => {
  await startCheckout(); await click('Save test card'); await click('Close')
  expect(container.textContent).toContain('your first payment is not complete')
  await click('Check payment status / finish payment')
  expect(container.textContent).toContain('Pay and subscribe')
  expect(fixture.setup).toHaveBeenCalledOnce()
})

test.each(['upgrade', 'overview'])('return from Stripe resumes outstanding payment on %s', async surface => {
  window.history.replaceState({}, '', '/?card_setup=complete')
  await render(surface === 'upgrade' ? <BillingOnboardingPanel status={fixture.status} /> : <BillingOverview status={fixture.status} />)
  expect(container.textContent).toContain('Pay and subscribe')
  expect(fixture.confirm).toHaveBeenCalledOnce()
  expect(fixture.setup).not.toHaveBeenCalled()
})
