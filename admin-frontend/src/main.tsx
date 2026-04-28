import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { routeTree } from './routeTree.gen'
import { supabase } from '@/shared/lib/supabase'
import { useAuthStore } from '@/shared/stores/auth'
import { legalApi } from '@/shared/lib/legal'
import './index.css'

supabase.auth.onAuthStateChange(async (event, session) => {
  if (session) {
    useAuthStore.getState().setAuth(session.access_token, {
      id: session.user.id,
      email: session.user.email ?? '',
      firstName: session.user.user_metadata?.first_name ?? '',
      lastName: session.user.user_metadata?.last_name ?? '',
      role: session.user.user_metadata?.role ?? '',
    })
    // On sign-in or app load, restore terms acceptance status from the
    // database so users don't have to re-accept on every login.
    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
      try {
        const status = await legalApi.getStatus()
        if (status.accepted && status.accepted_version) {
          useAuthStore.getState().setTermsAccepted(status.accepted_version)
        }
      } catch {
        // Backend unavailable — the terms gate will handle it when they navigate
      }
    }
  } else {
    useAuthStore.getState().clearAuth()
  }
})

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
