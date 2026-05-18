import { createFileRoute, redirect, Outlet, Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, startOfWeek, endOfWeek } from 'date-fns'
import { Menu } from 'lucide-react'
import { WEEK_STARTS_ON } from '@/shared/lib/date'
import { isAdminRole } from '@/shared/lib/roles'
import { useAuthStore } from '@/shared/stores/auth'
import { supabase } from '@/shared/lib/supabase'
import { Sidebar } from '@/shared/components/layout/Sidebar'
import { billingApi } from '@/features/billing/api'

export const Route = createFileRoute('/_protected')({
  beforeLoad: () => {
    const { accessToken } = useAuthStore.getState()
    if (!accessToken) throw redirect({ to: '/login' })
  },
  component: ProtectedLayout,
})

const now     = new Date()
const weekNum = Math.ceil(
  ((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7
)
const wkStart = format(startOfWeek(now, { weekStartsOn: WEEK_STARTS_ON }), 'MMM d')
const wkEnd   = format(endOfWeek(now,   { weekStartsOn: WEEK_STARTS_ON }), 'MMM d')

function WorkerAccessDenied() {
  const { clearAuth } = useAuthStore()

  async function handleSignOut() {
    await supabase.auth.signOut()
    clearAuth()
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-6">
      <div className="max-w-md w-full border border-ink bg-paper p-12 text-center">
        <p className="font-mono text-[9px] tracking-[0.15em] uppercase text-muted mb-3">Admin Console</p>
        <h1 className="font-serif text-[36px] leading-none font-medium tracking-[-0.02em] mb-4">
          You're all set.
        </h1>
        <p className="text-ink-soft text-[14px] leading-relaxed mb-10">
          Your account is set up as a Home Support Worker. The Homecare worker app is coming to iOS and Android soon. We'll send you an email the moment it's ready.
        </p>
        <button
          onClick={handleSignOut}
          className="w-full py-3.5 bg-ink text-cream font-mono text-[11px] tracking-[0.1em] uppercase hover:opacity-80 transition-opacity"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}

function PaymentGate() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-6">
      <div className="max-w-md w-full border border-ink bg-paper p-12 text-center">
        <p className="font-mono text-[9px] tracking-[0.15em] uppercase text-muted mb-3">Trial expired</p>
        <h1 className="font-serif text-[36px] leading-none font-medium tracking-[-0.02em] mb-4">
          Ready to continue?
        </h1>
        <p className="text-ink-soft text-[14px] leading-relaxed mb-10">
          Your 14-day free trial has ended. Subscribe for $700/month to keep your agency running.
        </p>
        <button
          onClick={() => navigate({ to: '/upgrade' })}
          className="w-full py-3.5 bg-orange text-white font-mono text-[11px] tracking-[0.1em] uppercase hover:opacity-80 transition-opacity"
        >
          Subscribe — $700 / month
        </button>
      </div>
    </div>
  )
}

function ProtectedLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user } = useAuthStore()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  const { data: billingStatus, isLoading: billingLoading } = useQuery({
    queryKey: ['billing-status', user?.id],
    queryFn:  billingApi.getStatus,
    staleTime: 5 * 60 * 1000,
  })

  if (!isAdminRole(user?.role)) {
    return <WorkerAccessDenied />
  }

  if (billingLoading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <p className="font-mono text-[10px] tracking-[0.15em] uppercase text-muted">Verifying access…</p>
      </div>
    )
  }

  // Let expired-trial users through to /upgrade so they can subscribe
  if (billingStatus?.has_access === false && pathname !== '/upgrade') {
    return <PaymentGate />
  }

  return (
    <div className="flex h-screen bg-cream overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink/30 max-lg:block hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <div className="flex items-center justify-between border-b border-ink px-6 max-lg:px-4 py-1.5 shrink-0 bg-cream gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="hidden max-lg:flex p-1 -ml-1 text-ink-soft hover:text-ink transition-colors shrink-0"
              aria-label="Open menu"
            >
              <Menu size={16} />
            </button>
            <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-soft truncate">
              HMCR-2026 · Admin Console
              {billingStatus?.is_trial_active && billingStatus?.subscription_status !== 'active' && (
                <Link to="/upgrade" className="ml-3 text-orange font-bold hover:underline">
                  · Trial: {billingStatus.trial_days_left} days left · Subscribe
                </Link>
              )}
            </span>
          </div>
          <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-ink-soft shrink-0 max-sm:hidden">
            WK {weekNum} · {wkStart}–{wkEnd} · {now.getFullYear()}
          </span>
        </div>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
