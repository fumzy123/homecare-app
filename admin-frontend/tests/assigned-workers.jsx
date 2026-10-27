// Actual weekly care editor and assignment dialogs; all data is fictional.
import React from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRootRoute, createRoute, createRouter, createMemoryHistory, RouterProvider, Outlet } from '@tanstack/react-router'
import { apiClient } from '../src/shared/lib/api-client'
import { WeeklyCareNeedEditor } from '../src/features/weekly-care-need/components/WeeklyCareNeedEditor'
import { assignmentRows, revisions } from './assigned-workers-fixtures'
import '../src/index.css'
import '../src/features/clients/client-workspace.css'
if (!import.meta.env.DEV) throw new Error('Development fixture only')
const fixture = window.assignedWorkersFixture = { rows: structuredClone(assignmentRows), posts: [], fail: false, stale: false }
apiClient.defaults.adapter = async config => {
  const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data
  let data
  if (config.url === '/api/assignments') {
    if (fixture.fail) throw new Error('Fixture unavailable')
    data = { today: '2026-11-09', assignments: fixture.rows }
  } else if (config.url === '/api/clients/client-demo/care-need') data = revisions
  else if (config.url === '/api/clients/client-demo') data = { id: 'client-demo', first_name: 'Evelyn', last_name: 'Demo' }
  else if (config.url === '/api/placements') data = []
  else if (config.url === '/api/billing/status') data = { billing_timezone: 'America/St_Johns' }
  else if (config.url === '/api/assignments/end-review') data = { review_token: 'review', stops_from: body.stops_from, assignments: fixture.rows.filter(a => body.assignment_ids.includes(a.id)), series_count: body.assignment_ids.length }
  else if (config.url === '/api/assignments/end') {
    if (fixture.stale) throw new Error('The assignment changed. Review again.')
    if (body.review_token !== 'review') throw new Error('Review required')
    fixture.posts.push(body)
    for (const row of fixture.rows.filter(a => body.assignment_ids.includes(a.id))) {
      row.stops_from = body.stops_from; row.end_reason = body.reason; row.can_end = false; row.status = 'ending'
    }
    data = { placement_id: 'request-3', ended_count: body.assignment_ids.length }
  } else throw new Error(`Unexpected fixture request: ${config.url}`)
  return { config, data, status: 200, statusText: 'OK', headers: {} }
}
const root = createRootRoute({ component: () => <main className="client-workspace max-w-6xl mx-auto p-6"><Outlet /></main> })
const client = createRoute({ getParentRoute: () => root, path: '/', component: () => <WeeklyCareNeedEditor clientId="client-demo" attentionNeedId="revision-2" /> })
const request = createRoute({ getParentRoute: () => root, path: '/dashboard/placements/$placementId', component: () => <p>Existing care request approval workflow</p> })
const router = createRouter({ routeTree: root.addChildren([client, request]), history: createMemoryHistory({ initialEntries: ['/'] }) })
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
window.refreshAssignedWorkers = () => queryClient.invalidateQueries({ queryKey: ['assignments'] })
createRoot(document.getElementById('root')).render(<QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>)
