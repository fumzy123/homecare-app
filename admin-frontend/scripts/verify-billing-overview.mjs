import assert from 'node:assert/strict'
import path from 'node:path'
import { createServer } from 'vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRootRoute, createRouter, createMemoryHistory, RouterContextProvider } from '@tanstack/react-router'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const server = await createServer({ configFile: false, server: { middlewareMode: true }, resolve: { alias: { '@': path.resolve('src') } } })
try {
  const { BillingOverview, BillingPlanSummary } = await server.ssrLoadModule('/src/features/billing/components/BillingOverview.tsx')
  const { useAuthStore } = await server.ssrLoadModule('/src/shared/stores/auth.ts')
  useAuthStore.getInitialState().user = { id: 'owner', role: 'owner' }
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  qc.setQueryData(['billing-invoices', 'owner'], { pages: [{ invoices: [], next_cursor: null }], pageParams: [undefined] })
  qc.setQueryData(['billing-profile', 'owner'], { name: 'Agency owner', email: 'owner@example.test', address: {}, cards: [{ id: 'pm_1', brand: 'visa', last4: '4242', exp_month: 4, exp_year: 2030, is_default: true }] })
  qc.setQueryData(['billing-details', 'owner'], { card: { brand: 'visa', last4: '4242', exp_month: 4, exp_year: 2030 }, invoices: [] })
  qc.setQueryData(['billing-usage', 'owner', 'UTC', 'active'], {
    state: 'ready', period: { id: 'p1', starts_at: '2026-09-01T00:00:00Z', ends_at: '2026-10-01T00:00:00Z', agency_timezone: 'UTC', currency: 'cad', included_clients: 10, additional_client_amount_cents: 500, base_interval: 'month', finalization_eligible_at: '2026-10-04T00:00:00Z' },
    usage: { active_client_count: 30, additional_clients: 20, estimated_usage_amount_cents: 10000, calculated_at: '2026-09-20T00:00:00Z', clients: [] },
  })
  const router = createRouter({ routeTree: createRootRoute(), history: createMemoryHistory({ initialEntries: ['/settings/billing'] }) })
  const status = { new_billing_flow: true, subscription_status: 'active', plan_code: 'standard', plan_interval: 'month', base_amount_cents: 30000, subscription_current_period_end: '2026-10-01T00:00:00Z', billing_timezone: 'UTC' }
  const render = props => renderToStaticMarkup(createElement(QueryClientProvider, { client: qc }, createElement(RouterContextProvider, { router }, createElement(BillingOverview, { status: props }))))
  const html = render(status)
  for (const label of ['Compare plans', 'Monthly client usage', '30', '100.00', 'Invoice history', 'Payment method', '4242', 'Cancel renewal']) assert.ok(html.includes(label), label)
  assert.doesNotMatch(html, /Choose your plan|Subscribe with Stripe|I authorize|type="range"/)
  assert.match(html, /<details[^>]*><summary[^>]*>Billing breakdown/)
  assert.doesNotMatch(html, /<details[^>]*\bopen[ =>]/)
  const trial = render({ subscription_status: null, is_trial_active: true, trial_days_left: 8, trial_ends_at: '2026-10-01T00:00:00Z' })
  assert.match(trial, /Free trial/)
  assert.match(trial, /8 days left/)
  assert.match(trial, /Compare plans/)
  assert.doesNotMatch(trial, /Billing breakdown|Monthly client usage/)
  const payment = renderToStaticMarkup(createElement(BillingPlanSummary, { status: { ...status, subscription_status: 'past_due' }, owner: true, busy: false, onAction() {} }))
  assert.match(payment, /Payment needs attention/)
  const member = renderToStaticMarkup(createElement(BillingPlanSummary, { status, owner: false, busy: false, onAction() {} }))
  assert.doesNotMatch(member, /<button/)
  qc.clear()
  console.log('Billing overview checks passed: concise layout, expandable details, trial/payment states, owner actions')
} finally {
  await server.close()
}
