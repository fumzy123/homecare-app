// Development-only verification host. Every API request ends in this adapter.
import React from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRootRoute, createRoute, createRouter, createMemoryHistory, RouterProvider, Outlet, Link } from '@tanstack/react-router'
import { apiClient } from '../src/shared/lib/api-client'
import { AssignmentsPanel } from '../src/features/assignments/components/AssignmentsPanel'
import '../src/index.css'
if (!import.meta.env.DEV) throw new Error('Development fixture only')
const rows = ['MO', 'WE', 'FR'].map((day, i) => ({
  id: `assignment-${i}`, client_id: 'client-1', client_name: 'Margaret Example', worker_id: 'worker-1', worker_name: 'Blue Example',
  placement_id: 'request-1', care_slot_id: `slot-${i}`, day_of_week: day, start_time: '09:00:00', end_time: '11:00:00',
  service_type: 'personal_care', starts_on: '2026-09-01', stops_from: null, revision_ends_on: null,
  end_reason: null, status: 'active', can_end: true,
}))
window.assignmentFixture = { rows, posts: [], fail: false, failList: false }
apiClient.defaults.adapter = async config => {
  const fixture = window.assignmentFixture
  const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data
  let data
  if (config.url === '/api/assignments') {
    if (fixture.failList) throw new Error('Unavailable')
    data = { today: '2026-10-09', assignments: rows }
  } else if (config.url === '/api/assignments/end-review') {
    data = { review_token: 'fixture-review', stops_from: body.stops_from, assignments: rows.filter(a => body.assignment_ids.includes(a.id)), series_count: body.assignment_ids.length }
  } else if (config.url === '/api/assignments/end') {
    fixture.posts.push(body)
    if (fixture.fail) throw new Error('The assignment changed. Review again.')
    if (body.review_token !== 'fixture-review') throw new Error('Review missing')
    for (const row of rows.filter(a => body.assignment_ids.includes(a.id))) {
      row.stops_from = body.stops_from; row.status = 'ended'; row.can_end = false; row.end_reason = body.reason
    }
    data = { placement_id: 'request-1', ended_count: body.assignment_ids.length }
  } else throw new Error(`Unexpected fixture call: ${config.url}`)
  return { config, data, status: 200, statusText: 'OK', headers: {} }
}
const root = createRootRoute({ component: () => <main className="max-w-5xl mx-auto p-6">
  <nav className="flex gap-5 p-4"><Link to="/worker">Worker profile</Link><Link to="/client">Client care</Link></nav><Outlet /></main> })
const worker = createRoute({ getParentRoute: () => root, path: '/worker', component: () => <AssignmentsPanel workerId="worker-1" /> })
const client = createRoute({ getParentRoute: () => root, path: '/client', component: () => <AssignmentsPanel clientId="client-1" /> })
const replacement = createRoute({ getParentRoute: () => root, path: '/dashboard/placements/$placementId', component: () => <p>Existing care request approval workflow</p> })
const router = createRouter({ routeTree: root.addChildren([worker, client, replacement]), history: createMemoryHistory({ initialEntries: ['/worker'] }) })
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
createRoot(document.getElementById('root')).render(<QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>)
