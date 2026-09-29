import assert from 'node:assert/strict'
import path from 'node:path'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const server = await createServer({ configFile: false, server: { middlewareMode: true },
  resolve: { alias: { '@': path.resolve('src') } } })
try {
  const { BillingUsageSummary, PendingUsageBalance } = await server.ssrLoadModule('/src/features/billing/components/BillingUsageSummary.tsx')
  const data = { period: { starts_at: '2026-09-01T00:00:00Z', ends_at: '2026-10-01T00:00:00Z',
    agency_timezone: 'UTC', included_clients: 10, additional_client_amount_cents: 500,
    currency: 'cad', finalization_eligible_at: '2026-10-04T00:00:00Z' },
    usage: { active_client_count: 30, additional_clients: 20, estimated_usage_amount_cents: 10000 } }
  const upcoming = { periods: [{ state: 'ready', usage_amount_cents: 40000, currency: 'cad' }],
    corrections: [], history_needs_review: false }
  const render = value => renderToStaticMarkup(createElement(BillingUsageSummary, { data, upcoming: value }))
  let html = render(upcoming)
  assert.match(html, /100\.00/)
  const annual = { ...upcoming, annual_settlement: true, collection_at: '2026-10-04T00:00:00Z', base: { state: 'scheduled' } }
  html = render(annual)
  assert.match(html, /Usage to add to your annual invoice/)
  assert.match(html, /500\.00/)
  assert.match(html, /No monthly usage payment/)
  html = renderToStaticMarkup(createElement(PendingUsageBalance, { upcoming: { ...annual, base: { state: 'canceled' } } }))
  assert.match(html, /400\.00/)
  assert.match(html, /Final usage only; renewal canceled/)
  assert.doesNotMatch(html, /500\.00/)
  html = renderToStaticMarkup(createElement(BillingUsageSummary, { data: { ...data, trial_preview: true, usage: { ...data.usage, estimated_usage_amount_cents: 0 } } }))
  assert.match(html, /No usage charges/)
  assert.doesNotMatch(html, /100\.00/)
  html = render(upcoming)
  assert.match(html, /400\.00/)
  assert.match(html, /500\.00/)
  assert.match(html, /Earlier usage awaiting billing/)
  assert.doesNotMatch(html, /rounded/)
  html = render({ ...upcoming, history_needs_review: true })
  assert.match(html, /not confirmed yet/)
  assert.doesNotMatch(html, /500\.00/)
  html = render({ ...upcoming, corrections: [{ amount_cents: -500 }] })
  assert.doesNotMatch(html, /500\.00/)
  assert.match(html, /billing adjustment/)
  html = render({ ...upcoming, periods: [] })
  assert.doesNotMatch(html, /400\.00|500\.00/)
  assert.match(html, /100\.00/)
  console.log('Billing usage summary checks passed')
} finally { await server.close() }
