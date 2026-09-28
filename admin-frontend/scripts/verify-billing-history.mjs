// Render the real history components without a browser or external requests.
import assert from 'node:assert/strict'
import path from 'node:path'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const server = await createServer({ configFile: false, server: { middlewareMode: true },
  resolve: { alias: { '@': path.resolve('src') } } })
try {
  const { InvoiceHistorySection, BillingUsageHistorySection } = await server.ssrLoadModule('/src/features/billing/components/BillingHistorySection.tsx')
  function render(Component, key, page, status = 'success') {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    if (status === 'error') {
      client.getQueryCache().build(client, { queryKey: [key, undefined] }, {
        data: undefined, dataUpdateCount: 0, dataUpdatedAt: 0, error: new Error('Unavailable'),
        errorUpdateCount: 1, errorUpdatedAt: Date.now(), fetchFailureCount: 1,
        fetchFailureReason: null, fetchMeta: null, isInvalidated: false, status: 'error', fetchStatus: 'idle',
      })
    } else if (page) {
      client.setQueryData([key, undefined], { pages: [page], pageParams: [undefined] })
    }
    const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(Component)))
    client.clear()
    return html
  }
  let html = render(InvoiceHistorySection, 'billing-invoices', { invoices: [], next_cursor: null })
  assert.match(html, /No invoices yet/)
  html = render(InvoiceHistorySection, 'billing-invoices', null, 'error')
  assert.match(html, /Could not load invoices/)
  assert.doesNotMatch(html, /No invoices yet/)
  html = render(InvoiceHistorySection, 'billing-invoices', null)
  assert.match(html, /Loading invoices/)
  html = render(InvoiceHistorySection, 'billing-invoices', { invoices: [{
    id: 'in_unpaid', number: 'CH-123', total: 40000, amount_paid: 0, amount_remaining: 40000,
    created: 1234567890, currency: 'cad', status: 'open', hosted_invoice_url: null,
  }], next_cursor: 'in_unpaid' })
  assert.match(html, /400\.00/)
  assert.match(html, /Payment outstanding/)
  assert.match(html, /Load older invoices/)
  assert.match(html, /Not available yet/)
  assert.doesNotMatch(html, /href=/)
  html = render(BillingUsageHistorySection, 'billing-history', { periods: [], next_cursor: null })
  assert.match(html, /No finalized usage periods yet/)
  html = render(BillingUsageHistorySection, 'billing-history', { periods: [{
    period_id: 'period-1', starts_at: '2026-08-01T00:00:00Z', ends_at: '2026-09-01T00:00:00Z',
    agency_timezone: 'America/St_Johns', active_client_count: 12, additional_clients: 2,
    currency: 'cad', usage_amount_cents: 1000,
  }], next_cursor: null })
  assert.match(html, /12 active clients/)
  assert.match(html, /10\.00.*original usage/)
  assert.match(html, /aria-expanded="false"/)
  assert.match(html, /View corrections and payments/)
  const { UpcomingBillingDetails } = await server.ssrLoadModule('/src/features/billing/components/UpcomingBillingSection.tsx')
  const upcoming = { calculated_at: '2026-09-28T00:00:00Z', history_needs_review: false, tax_status: 'not_calculated',
    base: { state: 'scheduled', interval: 'year', amount_cents: 300000, scheduled_at: '2027-08-01T00:00:00Z' },
    periods: [{ id: 'pending', starts_at: '2026-08-01T00:00:00Z', ends_at: '2026-09-01T00:00:00Z',
      agency_timezone: 'UTC', finalization_eligible_at: '2026-09-04T00:00:00Z', currency: 'cad',
      usage_amount_cents: null, state: 'awaiting_finalization' }], corrections: [],
  }
  const renderUpcoming = data => renderToStaticMarkup(createElement(UpcomingBillingDetails, { data, timezone: 'UTC' }))
  html = renderUpcoming(upcoming)
  assert.match(html, /Next annual base renewal/)
  assert.match(html, /3,000\.00/)
  assert.match(html, /amount not yet confirmed/)
  assert.doesNotMatch(html, /CAD[^<]*\b0\.00/)
  assert.doesNotMatch(html, /Next monthly base renewal/)
  html = renderUpcoming({ ...upcoming, base: { ...upcoming.base, state: 'canceled', amount_cents: null },
    corrections: [{ id: 'credit', amount_cents: -500, currency: 'cad', state: 'credited', payment_status: 'refund_pending' }] })
  assert.match(html, /Automatic base renewal is canceled/)
  assert.match(html, /Refund processing/)
  assert.doesNotMatch(html, /3,000\.00/)
  html = renderUpcoming({ ...upcoming, periods: [{ ...upcoming.periods[0], usage_amount_cents: 0, state: 'ready' }] })
  assert.match(html, /0\.00 finalized usage/)
  const { OperatorCorrectionReview } = await server.ssrLoadModule('/src/features/billing/components/OperatorCorrectionPanel.tsx')
  const proposal = { id: 'proposal', amount_cents: -500, currency: 'cad', status: 'pending', reason: '<script>not markup</script>',
    decision_reason: null, settlement_status: 'not_approved', payload: {
      baseline_clients: Array.from({ length: 12 }, (_, i) => ({ client_id: String(i) })),
      corrected_clients: Array.from({ length: 11 }, (_, i) => ({ client_id: String(i) })),
      added_client_ids: [], removed_client_ids: ['11'], included_clients: 10, additional_client_amount_cents: 500,
      baseline_usage_amount_cents: 1000, corrected_usage_amount_cents: 500,
    } }
  html = renderToStaticMarkup(createElement(OperatorCorrectionReview, { row: proposal, busy: false, onDecision: () => {} }))
  assert.match(html, /Credit.*5\.00/)
  assert.match(html, /12.*11/)
  assert.match(html, /&lt;script&gt;/)
  assert.match(html, /disabled="" type="submit"/)
  assert.match(html, /Approval authorizes settlement/)
  html = renderToStaticMarkup(createElement(OperatorCorrectionReview, { row: { ...proposal, status: 'approved' }, busy: false, onDecision: () => {} }))
  assert.doesNotMatch(html, /type="submit"/)
  assert.doesNotMatch(html, /Reject proposal/)
  console.log('Billing rendering checks passed, including upcoming charges and operator correction review safeguards.')
} finally {
  await server.close()
}
