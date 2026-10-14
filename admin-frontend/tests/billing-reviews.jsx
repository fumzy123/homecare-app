// Development fixture: all API requests use fictional in-memory records.
import React from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { apiClient } from '../src/shared/lib/api-client'
import { useAuthStore } from '../src/shared/stores/auth'
import { BillingReviewForm } from '../src/features/billing/components/BillingReviewForm'
import { OperatorBillingReviews } from '../src/features/billing/components/OperatorBillingReviews'
import '../src/index.css'
if (!import.meta.env.DEV) throw new Error('Development fixture only')
useAuthStore.setState({ user: { id: 'fictional-operator', role: 'owner' }, accessToken: null })
window.billingReviewFixture = { rows: [], calls: [], fail: false }
apiClient.defaults.adapter = async config => {
  const fixture = window.billingReviewFixture
  const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data
  fixture.calls.push({ url: config.url, method: config.method, body })
  if (fixture.fail) throw new Error('Temporary connection failure')
  let data
  if (config.url.endsWith('/resolve')) {
    const row = fixture.rows.find(row => config.url.includes(row.id))
    row.status = 'resolved'; row.response = body.response; row.resolved_at = new Date().toISOString(); data = row
  } else if (config.url.includes('/operator/')) {
    data = { requests: fixture.rows.filter(row => row.status === 'open').map(row => ({ ...row, agency_name: 'Fictional Agency' })), has_more: false }
  } else if (config.method === 'post') {
    data = { id: crypto.randomUUID(), org_id: 'org-fictional', period_id: 'period-fictional', submitted_at: new Date().toISOString(), message: body.message, status: 'open', response: null, resolved_at: null }
    fixture.rows.push(data)
  } else data = fixture.rows
  return { config, data: structuredClone(data), status: 200, statusText: 'OK', headers: {} }
}
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
createRoot(document.getElementById('root')).render(<QueryClientProvider client={queryClient}><main className="max-w-4xl p-6 mx-auto space-y-8">
  <h1>Billing review verification</h1><BillingReviewForm periodId="period-fictional" /><OperatorBillingReviews onSelect={org => { window.billingReviewFixture.selected = org }} />
</main></QueryClientProvider>)
