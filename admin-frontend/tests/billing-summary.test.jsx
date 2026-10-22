import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'
import { BillingPaymentSummary } from '../src/features/billing/components/BillingPaymentSummary'
import { BillingUsageSummary } from '../src/features/billing/components/BillingUsageSummary'
import { BillingUsageDetails } from '../src/features/billing/components/BillingUsageDetails'

vi.mock('../src/shared/stores/auth', () => ({ useAuthStore: () => undefined }))
vi.mock('../src/shared/lib/api-client', () => ({ apiClient: {} }))

const status = { new_billing_flow: true, subscription_status: 'active', is_trial_active: false, billing_timezone: 'America/St_Johns' }
const upcoming = { base: { state: 'scheduled', amount_cents: 35000, interval: 'month', scheduled_at: '2026-11-14T16:16:13Z' }, periods: [], corrections: [], history_needs_review: false }
const usage = { state: 'ready', period: { id: 'current', starts_at: '2026-10-14T16:16:13Z', ends_at: '2026-11-14T16:16:13Z', finalization_eligible_at: '2026-11-17T16:16:13Z', agency_timezone: 'America/St_Johns', currency: 'cad', included_clients: 10, additional_client_amount_cents: 1000 }, usage: { active_client_count: 13, additional_clients: 3, estimated_usage_amount_cents: 3000, clients: [{client_id:'client1', client_name:'Sample Client', local_start:'2026-10-15T09:00:00', occurrence_date:'2026-10-15', completion_status:'no_show'}] } }
const render = (props = {}) => renderToStaticMarkup(<BillingPaymentSummary status={status} upcoming={upcoming} usage={usage} loading={false} failed={false} onRetry={() => {}} {...props} />)

test('monthly summary combines verified base and usage, with the correction-window date', () => {
  const html = render()
  expect(html).toContain('CA$380.00')
  expect(html).toMatch(/Expected after Nov 17, 2026/)
  expect(html).toContain('Before tax')
  expect(html).toContain('not a guaranteed debit date')
})
test('trial keeps zero due today and uses the actual first-payment amount and date', () => {
  const html = render({status:{...status,is_trial_active:true,subscription_status:'trialing',trial_ends_at:'2026-10-20T16:00:00Z'},upcoming:{...upcoming,base:{...upcoming.base,state:'first_payment'}},usage:{...usage,trial_preview:true}})
  expect(html).toContain('CA$0.00')
  expect(html).toContain('First payment: CA$350.00 on Oct 20, 2026')
  expect(html).not.toContain('CA$380.00')
})
test('annual summary includes accrued usage once and calls future usage an estimate', () => {
  const html = render({upcoming:{...upcoming,annual_settlement:true,collection_at:'2027-10-17T16:00:00Z',base:{...upcoming.base,interval:'year',amount_cents:336000},periods:[{id:'previous',state:'ready',usage_amount_cents:12000,currency:'cad'},{id:'current',state:'ready',usage_amount_cents:3000,currency:'cad'}]}})
  expect(html).toContain('CA$3,510.00')
  expect(html).toContain('CA$150.00')
  expect(html).toContain('Future usage can increase this estimate')
})
test.each(['incomplete','past_due','unpaid','paused'])('%s cannot appear as an upcoming paid subscription', subscription_status => {
  const html = render({status:{...status,subscription_status}})
  expect(html).toContain('Payment incomplete')
  expect(html).not.toContain('CA$380.00')
})
test.each([
  {failed:true}, {loading:true}, {usage:undefined},
  {upcoming:{...upcoming,history_needs_review:true}},
  {upcoming:{...upcoming,corrections:[{amount_cents:-500}]}},
  {upcoming:{...upcoming,periods:[{id:'previous',state:'ready',usage_amount_cents:4000,currency:'cad'}]}},
  {upcoming:{...upcoming,annual_settlement:true,periods:[{id:'previous',state:'awaiting_finalization',usage_amount_cents:null,currency:'cad'}]}},
  {usage:{...usage,period:{...usage.period,currency:'usd'}}},
  {upcoming:{...upcoming,base:{...upcoming.base,scheduled_at:'2026-12-14T16:16:13Z'}}},
])('unverified obligations never show a complete upcoming total: %j', props => {
  expect(render(props)).not.toContain('CA$380.00')
})
test('cancellation removes base renewal without hiding possible final usage', () => {
  const html=render({status:{...status,billing_canceled:true}})
  expect(html).toContain('No base renewal')
  expect(html).toContain('Outstanding usage')
  expect(html).not.toContain('CA$380.00')
})
test('usage summary keeps counting policy and exact DST boundaries on demand', () => {
  const html=renderToStaticMarkup(<BillingUsageSummary data={usage} action={<button>View counted clients</button>} />)
  expect(html).toContain('CA$30.00')
  expect(html).toContain('View counted clients')
  expect(html).toContain('no-show')
  expect(html).toContain('NDT')
  expect(html).toContain('NST')
  expect(html).toContain('Corrections close')
  expect(html).not.toMatch(/<details[^>]*\bopen/)
})
test('trial usage remains free even when its projected paid usage is nonzero', () => {
  const html=renderToStaticMarkup(<BillingUsageSummary data={{...usage,trial_preview:true}} />)
  expect(html).toContain('CA$0.00')
  expect(html).not.toContain('CA$30.00')
})
test('counted-client drilldown preserves evidence without repeating summary panels', () => {
  const html=renderToStaticMarkup(<BillingUsageDetails data={usage} clientsOnly />)
  expect(html).toContain('Sample Client')
  expect(html).toContain('No-show')
  expect(html).not.toContain('Estimated additional-client charge')
})
