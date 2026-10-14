// Development-only fixture. No credentials or agency records leave this page.
import React from 'react'
import { createRoot } from 'react-dom/client'
import { createRouter, createRootRoute, createRoute, RouterProvider, Outlet, createMemoryHistory } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LoginForm } from '../src/features/auth/components/LoginForm'
import { WorkspaceLanding } from '../src/features/auth/components/WorkspaceLanding'
import { authApi } from '../src/features/auth/api'
import { apiClient } from '../src/shared/lib/api-client'
import { useAuthStore } from '../src/shared/stores/auth'
if (!import.meta.env.DEV) throw new Error('Development fixture only')
window.operatorFixture = { mode: 'operator', calls: [] }
useAuthStore.getState().clearAuth()
authApi.signIn = async () => {
  useAuthStore.getState().setAuth('fictional-token', { id: 'fictional-user', email: 'fixture@example.invalid', role: 'owner' })
}
apiClient.defaults.adapter = async config => {
  window.operatorFixture.calls.push(config.url)
  const mode = window.operatorFixture.mode
  if (mode !== 'operator') throw { config, response: { status: mode === 'agency' ? 403 : 503, data: { error: { code: mode === 'agency' ? 'FORBIDDEN' : 'UNAVAILABLE' } } } }
  return { config, data: { is_operator: true }, status: 200, statusText: 'OK', headers: {} }
}
const root = createRootRoute({ component: Outlet })
const routes = [
  createRoute({ getParentRoute: () => root, path: '/login', component: LoginForm }),
  createRoute({ getParentRoute: () => root, path: '/workspace', component: WorkspaceLanding }),
  createRoute({ getParentRoute: () => root, path: '/billing-operations', component: () => <h1>Operator workspace reached</h1> }),
  createRoute({ getParentRoute: () => root, path: '/dashboard', component: () => <h1>Agency dashboard reached</h1> }),
]
const router = createRouter({ routeTree: root.addChildren(routes), history: createMemoryHistory({ initialEntries: ['/login'] }) })
createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient()}><RouterProvider router={router} /></QueryClientProvider>)
