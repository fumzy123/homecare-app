// Development-only preview. Every API request is handled with fictional data.
import React from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { apiClient } from '../src/shared/lib/api-client'
import { useAuthStore } from '../src/shared/stores/auth'
import { BillingOperatorPage } from '../src/features/billing/components/BillingOperatorPage'
import '../src/index.css'
if (!import.meta.env.DEV) throw new Error('Development fixture only')
useAuthStore.setState({ user: { id: 'fictional-operator', role: 'owner' }, accessToken: null })
const populated = new URLSearchParams(location.search).has('populated')
const agencies = [
  { id: 'agency-sunrise', name: 'Sunrise Home Care', subscription_status: null },
  { id: 'agency-harbor', name: 'Harbor Community Care', subscription_status: 'active' },
  { id: 'agency-maple', name: 'Maple Home Support', subscription_status: 'past_due' },
].map(row => ({ ...row, onboarding_deadline_at: '2026-11-01T00:00:00Z', deleted_at: null }))
window.billingOperationsFixture = {
  calls: [], failures: [], delay: 0, operator: true,
  agencies: populated ? agencies : agencies.slice(0, 1),
  events: populated ? [{ event_id: 'evt_fictional_payment', event_type: 'invoice.payment_failed', state: 'failed', attempts: 3, received_at: '2026-10-14T09:00:00Z', next_attempt_at: '2026-10-14T10:00:00Z', lease_until: null, error_code: 'REVIEW_REQUIRED' }] : [],
  questions: populated ? [{ id: 'question-fictional', org_id: 'agency-maple', agency_name: 'Maple Home Support', period_id: 'period-fictional', submitted_at: '2026-10-13T16:00:00Z', message: 'Could you review our client count for the September billing period?', status: 'open' }] : [],
}
apiClient.defaults.adapter = async config => {
  const fixture = window.billingOperationsFixture
  const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data
  fixture.calls.push({ url: config.url, method: config.method, body, params: config.params })
  if (fixture.delay) await new Promise(resolve => setTimeout(resolve, fixture.delay))
  if (fixture.failures.some(path => config.url.endsWith(path))) throw new Error('Temporary connection failure')
  let data
  const url = config.url
  if (url.endsWith('/access')) data = { is_operator: fixture.operator, onboarding_enabled: populated, settlement_enabled: false, live_settlement_enabled: false }
  else if (url.endsWith('/webhooks')) data = { events: fixture.events, has_more: false }
  else if (url.endsWith('/resolve')) { data = fixture.questions[0]; fixture.questions = [] }
  else if (url.endsWith('/review-requests')) data = { requests: fixture.questions, has_more: false }
  else if (url.endsWith('/organizations')) {
    const rows = fixture.agencies.filter(row => row.name.toLowerCase().includes((config.params.search || '').toLowerCase()))
    data = { agencies: config.params.before ? rows.slice(2) : rows.slice(0, 2), next_cursor: !config.params.before && rows.length > 2 ? 'next' : null }
  } else if (url.endsWith('/periods')) data = { periods: [], next_cursor: null }
  else if (config.method === 'post') data = { recorded: true }
  else if (/\/organizations\/[^/]+$/.test(url)) {
    const agency = agencies.find(row => url.endsWith(row.id))
    data = { organization: { ...agency, onboarding_completed_at: null, trial_ends_at: null, billing_recovery_checked_at: null, billing_recovery_error: null }, plan: null, activation: null, founding: null, conversion: null, issues: { settlements: [], cutoffs: [], holds: [], has_more: false } }
  } else throw new Error(`Unexpected fixture request: ${url}`)
  return { config, data: structuredClone(data), status: 200, statusText: 'OK', headers: {} }
}
const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}><BillingOperatorPage /></QueryClientProvider>)
