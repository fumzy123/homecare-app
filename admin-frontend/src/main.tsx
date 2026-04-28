import * as Sentry from '@sentry/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { routeTree } from './routeTree.gen'
import { supabase } from '@/shared/lib/supabase'
import { useAuthStore } from '@/shared/stores/auth'
import './index.css'


// ─── Sentry ──────────────────────────────────────────────────────────────────
// Only active when VITE_SENTRY_DSN is set (staging / production).
// beforeSend strips any form values so patient data is never transmitted.

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.VITE_APP_ENV ?? 'development',
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate: 0.2,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request?.data) {
        delete event.request.data
      }
      return event
    },
  })
}


// ─── Auth ─────────────────────────────────────────────────────────────────────

supabase.auth.onAuthStateChange((_event, session) => {
  if (session) {
    useAuthStore.getState().setAuth(session.access_token, {
      id: session.user.id,
      email: session.user.email ?? '',
      firstName: session.user.user_metadata?.first_name ?? '',
      lastName: session.user.user_metadata?.last_name ?? '',
      role: session.user.user_metadata?.role ?? '',
    })
  } else {
    useAuthStore.getState().clearAuth()
  }
})


// ─── Router & Query client ────────────────────────────────────────────────────

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
