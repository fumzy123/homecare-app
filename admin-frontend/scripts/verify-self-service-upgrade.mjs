import assert from 'node:assert/strict'
import path from 'node:path'
import { createServer } from 'vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const server = await createServer({ configFile: false, server: { middlewareMode: true }, resolve: { alias: { '@': path.resolve('src') } } })
try {
  const { BillingOnboardingPanel } = await server.ssrLoadModule('/src/features/billing/components/BillingOnboardingPanel.tsx')
  const { useAuthStore } = await server.ssrLoadModule('/src/shared/stores/auth.ts')
  useAuthStore.setState({ user: { id: 'owner', role: 'owner' } })
  useAuthStore.getInitialState().user = useAuthStore.getState().user
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  qc.setQueryData(['billing-onboarding-options', 'owner'], {
    timezones: ['UTC'], consent_version: 'test', consent_text: 'I authorize the selected plan.',
    plans: [
      { code: 'standard', interval: 'month', base_amount_cents: 35000, included_clients: 10, additional_client_amount_cents: 500 },
      { code: 'standard', interval: 'year', base_amount_cents: 336000, included_clients: 10, additional_client_amount_cents: 500 },
    ],
  })
  const render = status => renderToStaticMarkup(createElement(QueryClientProvider, { client: qc }, createElement(BillingOnboardingPanel, { status })))
  const base = { subscription_status: null, billing_timezone: 'UTC', is_trial_active: true, trial_days_left: 8, trial_ends_at: '2090-01-01T00:00:00Z' }
  const html = render(base)
  assert.match(html, /Choose your plan/)
  assert.match(html, /Continue/)
  assert.match(html, /350/)
  assert.match(html, /Yearly/)
  assert.match(html, /Save 20% on base/)
  assert.match(html, /type="range"/)
  assert.match(html, /Nothing due today/)
  assert.doesNotMatch(html, /not been enrolled|Contact Care Harbor|Founding ·/)
  assert.match(html, /disabled=""[^>]*>Continue/) // Consent required.
  const expired = render({ ...base, is_trial_active: false, trial_ends_at: '2020-01-01T00:00:00Z' })
  assert.match(expired, /first base payment is due when you finish subscribing/)
  assert.doesNotMatch(expired, /Nothing due today/)
  const subscribed = render({ ...base, is_trial_active: false, subscription_status: 'active', plan_code: 'standard' })
  assert.doesNotMatch(subscribed, /Subscribe with Stripe/)
  assert.doesNotMatch(subscribed, /Payment methods and invoices/)
  const { SubscriptionPlans } = await server.ssrLoadModule('/src/features/billing/components/SubscriptionPlans.tsx')
  const plans = qc.getQueryData(['billing-onboarding-options', 'owner']).plans
  const annual = renderToStaticMarkup(createElement(SubscriptionPlans, { plans, interval: 'year', onChange() {}, disabled: false }))
  assert.equal((annual.match(/<article\b/g) ?? []).length, 1)
  assert.match(annual, /\$280/)
  assert.match(annual, /CAD \/ month equivalent/)
  assert.match(annual, /\$3,360 CAD billed annually/)
  assert.match(annual, /\$3,360\/year \+ \$0\/month/)
  assert.doesNotMatch(annual, /rounded-/)
  const founder = renderToStaticMarkup(createElement(SubscriptionPlans, { plans: [{ ...plans[0], code: 'founding', base_amount_cents: 20000, additional_client_amount_cents: 400 }], interval: 'month', onChange() {}, disabled: false }))
  assert.match(founder, /\$200/)
  assert.doesNotMatch(founder, /Yearly|type="radio"/)
  qc.clear()
  console.log('Self-service upgrade rendering checks passed')
} finally {
  await server.close()
}
