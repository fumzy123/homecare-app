// Development-only fixture host. Imports the actual components; all API requests
// terminate in this adapter. No login, token, database or production entry changes.
import React from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  RouterProvider,
  Outlet,
} from '@tanstack/react-router'
import { addDays, format, startOfWeek } from 'date-fns'
import { apiClient } from '../src/shared/lib/api-client'
import { ClientWorkspace } from '../src/features/clients/components/ClientWorkspace'
import { ClientDirectory } from '../src/features/clients/components/ClientDirectory'
import { ClientOverview } from '../src/features/clients/components/ClientOverview'
import { ClientCareMetrics } from '../src/features/clients/components/ClientCareMetrics'
import { ClientFunding } from '../src/features/clients/components/ClientFunding'
import { ClientNotes } from '../src/features/clients/components/ClientNotes'
import { ClientEdit } from '../src/features/clients/components/ClientEdit'
import { WeeklyCareNeedEditor } from '../src/features/weekly-care-need/components/WeeklyCareNeedEditor'
import { Sidebar } from '../src/shared/components/layout/Sidebar'
import '../src/index.css'

if (!import.meta.env.DEV)
  throw new Error('Fixture host is available only in development')
const id = '11111111-1111-4111-8111-111111111111'
const week = startOfWeek(new Date())
const day = (n) => format(addDays(week, n), 'yyyy-MM-dd')
const stamp = new Date().toISOString()
const workers = [
  {
    id: 'worker-1',
    first_name: 'Sophie',
    last_name: 'Williams',
    role: 'home_support_worker',
    employment_status: 'active',
    email: 'sophie@example.test',
  },
  {
    id: 'worker-2',
    first_name: 'Daniel',
    last_name: 'Chen',
    role: 'home_support_worker',
    employment_status: 'active',
    email: 'daniel@example.test',
  },
]
const slots = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'].map(
  (day_of_week, i) => ({
    id: `slot-${i}`,
    day_of_week,
    start_time: '09:30:00',
    end_time: '11:30:00',
    service_type: i === 6 ? 'homemaking' : 'personal_care',
  }),
)
let needs = [
  {
    id: 'need-4',
    client_id: id,
    version: 4,
    imported: false,
    effective_from: day(8),
    created_at: stamp,
    activated_at: null,
    scheduled_from: null,
    ends_on: null,
    supersedes_id: 'need-3',
    care_slots: slots.map((s, i) => ({
      ...s,
      id: `next-${i}`,
      start_time: i === 0 ? '10:30:00' : s.start_time,
    })),
  },
  {
    id: 'need-3',
    client_id: id,
    version: 3,
    imported: false,
    effective_from: day(0),
    created_at: stamp,
    activated_at: stamp,
    scheduled_from: day(0),
    ends_on: null,
    supersedes_id: null,
    care_slots: slots,
  },
]
let clients = [
  {
    id,
    org_id: 'fixture-org',
    first_name: 'Margaret',
    last_name: 'Bennett',
    date_of_birth: '1948-02-18',
    gender: 'female',
    phone_number: '7095550104',
    email: null,
    street: '14 Example Lane',
    city: 'St. John’s',
    province: 'NL',
    postal_code: 'A1B 2K3',
    care_arrangement: 'funded',
    status: 'active',
    allergies: 'Penicillin',
    medical_conditions: 'Osteoarthritis; reduced mobility',
    medications: null,
    special_instructions:
      'Use the side entrance. Allow extra time on the stairs.',
    notes: null,
    emergency_contact_name: 'Sarah Bennett',
    emergency_contact_phone: '7095550122',
    emergency_contact_relationship: 'Daughter',
    care_team: workers.map((w, i) => ({
      ...w,
      coverage: [i === 0 ? 'Mon · Wed · Fri' : 'Tue · Thu'],
    })),
    service_types: ['personal_care', 'homemaking'],
    care_start: day(-90),
    care_end: day(90),
    coverage: 'covered',
    created_at: stamp,
    updated_at: stamp,
    current_care_need: needs[1],
  },
]
let auths = [
  {
    id: 'auth-1',
    client_id: id,
    funder: 'NL Health Services',
    authorization_number: 'NL-2026-0482',
    funder_file_number: null,
    covering_start: day(-90),
    covering_end: day(90),
    date_issued: null,
    authorized_by: null,
    hours_period: 'bi_weekly',
    client_monthly_contribution_amount: null,
    invoice_to: null,
    cancelled_at: null,
    supersedes_id: null,
    notes: null,
    created_at: stamp,
    status: 'active',
    services: [
      { id: 'as-1', service_type: 'personal_care', authorized_hours: 28 },
      { id: 'as-2', service_type: 'homemaking', authorized_hours: 4 },
    ],
  },
]
const visits = [1, 2, 3, 4, 5].map((n, i) => ({
  shift_id: `shift-${i}`,
  modification_id: null,
  date: day(n),
  start_time: `${day(n)}T09:30:00`,
  end_time: `${day(n)}T11:30:00`,
  completion_status: i < 3 ? 'completed' : 'scheduled',
  is_modification: false,
  is_recurring: true,
  service_type: 'personal_care',
  worker: workers[i % 2],
  client: { id, first_name: 'Margaret', last_name: 'Bennett' },
  location: '14 Example Lane',
  notes: 'Assist with morning routine.',
  recurrence_end_date: null,
  recurrence_frequency: 'weekly',
  recurrence_days_of_week: [slots[i].day_of_week],
}))
let notes = visits
  .filter((v, i) => i === 0 || i === 2)
  .map((v) => ({
    id: `note-${v.shift_id}`,
    shift_id: v.shift_id,
    occurrence_date: v.date,
    worker_id: v.worker.id,
    worker_first_name: v.worker.first_name,
    worker_last_name: v.worker.last_name,
    entries: [
      {
        time: '11:20',
        content:
          'Morning care completed. Margaret was comfortable and enjoyed a short walk.',
      },
    ],
    created_at: stamp,
    updated_at: null,
  }))
let placements = [
  {
    id: 'placement-3',
    org_id: 'fixture-org',
    client_id: id,
    client_first_name: 'Margaret',
    client_last_name: 'Bennett',
    weekly_care_need_id: 'need-3',
    scheduled_from: day(0),
    transition_applied: true,
    start_date: day(0),
    status: 'open',
    covered_count: 5,
    care_slots: slots.map((s, i) => ({
      ...s,
      worker_id: i < 5 ? workers[i % 2].id : null,
      worker_name:
        i < 5
          ? `${workers[i % 2].first_name} ${workers[i % 2].last_name}`
          : null,
    })),
    interests: [],
    interest_count: 0,
    created_at: stamp,
    requirements: null,
    shift_description: 'Weekly care',
    masked_location: 'St. John’s',
    created_by: 'fixture-admin',
    filled_by: null,
    resolved_at: null,
  },
]
const response = (config, data) => ({
  config,
  status: 200,
  statusText: 'OK',
  headers: {},
  data: structuredClone(data),
})
apiClient.interceptors.request.clear()
apiClient.interceptors.response.clear()
apiClient.defaults.adapter = async (config) => {
  const url = config.url,
    method = config.method,
    body = config.data ? JSON.parse(config.data) : {}
  if (url === '/api/organization')
    return response(config, {
      id: 'fixture-org',
      name: 'Care Harbor',
      uses_authorizations: true,
    })
  if (url === '/api/org-members?role=home_support_worker')
    return response(config, workers)
  if (url === '/api/clients') {
    if (method === 'post') {
      const c = {
        ...clients[0],
        ...body,
        id: crypto.randomUUID(),
        care_team: [],
        current_care_need: null,
      }
      clients.push(c)
      return response(config, c)
    }
    return response(config, clients)
  }
  if (url === `/api/clients/${id}`) {
    if (method === 'patch') clients[0] = { ...clients[0], ...body }
    return response(config, clients[0])
  }
  if (url === `/api/clients/${id}/care-need`) {
    if (method === 'post') {
      const n = {
        ...needs[0],
        ...body,
        id: crypto.randomUUID(),
        version: needs[0].version + 1,
        care_slots: body.care_slots.map((s) => ({
          ...s,
          id: crypto.randomUUID(),
        })),
        activated_at: null,
        scheduled_from: null,
      }
      needs.unshift(n)
      return response(config, n)
    }
    return response(config, needs)
  }
  if (url === `/api/clients/${id}/authorizations`) {
    if (method === 'post') {
      const a = { ...auths[0], ...body, id: crypto.randomUUID() }
      if (a.supersedes_id)
        auths = auths.map((old) => ({
          ...old,
          status: old.id === a.supersedes_id ? 'superseded' : old.status,
        }))
      auths.unshift(a)
      return response(config, a)
    }
    return response(config, auths)
  }
  if (url === `/api/clients/${id}/notes`)
    return response(
      config,
      notes.filter(
        (n) =>
          n.occurrence_date >= config.params.from_date &&
          n.occurrence_date <= config.params.to_date,
      ),
    )
  if (url === '/api/shifts')
    return response(
      config,
      visits.filter(
        (v) =>
          !config.params ||
          (v.date >= config.params.from_date &&
            v.date <= config.params.to_date),
      ),
    )
  if (url?.match(/^\/api\/shifts\/[^/]+\/notes/)) {
    const shiftId = url.split('/')[3],
      date = body.occurrence_date || config.params?.date
    let note = notes.find(
      (n) => n.shift_id === shiftId && n.occurrence_date === date,
    )
    if (method === 'post') {
      if (!note) {
        note = {
          id: crypto.randomUUID(),
          shift_id: shiftId,
          occurrence_date: date,
          entries: [],
          created_at: stamp,
        }
        notes.push(note)
      }
      note.entries.push({ time: body.time, content: body.content })
    }
    return response(config, note || null)
  }
  if (url === '/api/placements') {
    if (method === 'post') {
      const n = needs.find((n) => n.id === body.weekly_care_need_id)
      const p = {
        ...placements[0],
        ...body,
        id: crypto.randomUUID(),
        scheduled_from: null,
        transition_applied: false,
        covered_count: 0,
        care_slots: n.care_slots.map((s) => ({
          ...s,
          worker_id: null,
          worker_name: null,
        })),
      }
      placements.unshift(p)
      return response(config, p)
    }
    return response(config, placements)
  }
  if (url?.startsWith('/api/placements/'))
    return response(
      config,
      placements.find((p) => p.id === url.split('/')[3]),
    )
  throw new Error(`No fixture for ${method} ${url}`)
}
const qc = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
})
const root = createRootRoute({
  component: () => (
    <div className="flex h-screen bg-cream">
      <Sidebar open={false} onClose={() => {}} />
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="border-b border-line px-10 py-4 font-mono text-xs text-ink-soft">
          LOCAL VERIFICATION · FICTIONAL DATA · ACTUAL APP COMPONENTS
        </div>
        <Outlet />
      </div>
    </div>
  ),
})
const directory = createRoute({
  getParentRoute: () => root,
  path: '/dashboard/clients',
  component: ClientDirectory,
})
const workspace = createRoute({
  getParentRoute: () => root,
  path: '/dashboard/clients/$clientId',
  component: () => <ClientWorkspace clientId={id} />,
})
const pages = [
  ['/', ClientOverview],
  ['visits', ClientCareMetrics],
  ['care-need', WeeklyCareNeedEditor],
  ['funding', ClientFunding],
  ['notes', ClientNotes],
  ['edit', ClientEdit],
].map(([path, Component]) =>
  createRoute({
    getParentRoute: () => workspace,
    path,
    component: () => <Component clientId={id} />,
  }),
)
const router = createRouter({
  routeTree: root.addChildren([directory, workspace.addChildren(pages)]),
  history: createMemoryHistory({
    initialEntries: [`/dashboard/clients/${id}`],
  }),
})
createRoot(document.getElementById('root')).render(
  <QueryClientProvider client={qc}>
    <RouterProvider router={router} />
  </QueryClientProvider>,
)
