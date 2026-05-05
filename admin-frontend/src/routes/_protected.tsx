import { createFileRoute, redirect, Outlet } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, startOfWeek, endOfWeek } from 'date-fns'
import { Menu } from 'lucide-react'
import { WEEK_STARTS_ON } from '@/shared/lib/date'
import { CURRENT_TERMS_VERSION } from '@/shared/lib/legal'
import { useAuthStore } from '@/shared/stores/auth'
import { Sidebar } from '@/shared/components/layout/Sidebar'
import { paymentsApi } from '@/features/payments/api'

export const Route = createFileRoute('/_protected')({
  beforeLoad: () => {
    const { accessToken, termsAcceptedVersion } = useAuthStore.getState()
    if (!accessToken) throw redirect({ to: '/login' })
    if (termsAcceptedVersion !== CURRENT_TERMS_VERSION) throw redirect({ to: '/accept-terms' })
  },
  component: ProtectedLayout,
})

const now      = new Date()
const weekNum  = Math.ceil(
  ((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7
)
const wkStart  = format(startOfWeek(now, { weekStartsOn: WEEK_STARTS_ON }), 'MMM d')
const wkEnd    = format(endOfWeek(now,   { weekStartsOn: WEEK_STARTS_ON }), 'MMM d')

function PaymentGate() {
  const [loading, setLoading] = useState(false)

  async function handleCheckout() {
    setLoading(true)
    try {
      const { url } = await paymentsApi.createCheckoutSession()
      window.location.href = url
    } catch {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-6">
      <div className="max-w-md w-full border border-ink bg-paper p-12 text-center">
        <p className="font-mono text-[9px] tracking-[0.15em] uppercase text-muted mb-3">Access required</p>
        <h1 className="font-serif text-[36px] leading-none font-medium tracking-[-0.02em] mb-4">
          Unlock Homecare OS
        </h1>
        <p className="text-ink-soft text-[14px] leading-relaxed mb-10">
          Get lifetime access for a one-time payment of $80. No subscription, no renewal.
        </p>
        <button
          onClick={handleCheckout}
          disabled={loading}
          className="w-full py-3.5 bg-orange text-white font-mono text-[11px] tracking-[0.1em] uppercase disabled:opacity-60"
        >
          {loading ? 'Redirecting…' : 'Get Lifetime Access — $80'}
        </button>
      </div>
    </div>
  )
}

function ProtectedLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const { data: paymentStatus, isLoading: paymentLoading } = useQuery({
    queryKey: ['payment-status'],
    queryFn: paymentsApi.getStatus,
    staleTime: 5 * 60 * 1000,
  })

  if (paymentLoading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <p className="font-mono text-[10px] tracking-[0.15em] uppercase text-muted">Verifying access…</p>
      </div>
    )
  }

  if (paymentStatus?.has_paid === false) {
    return <PaymentGate />
  }

  return (
    <div className="flex h-screen bg-cream overflow-hidden">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink/30 max-lg:block hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Topbar */}
        <div className="flex items-center justify-between border-b border-ink px-6 max-lg:px-4 py-1.5 shrink-0 bg-cream gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger — mobile only */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="hidden max-lg:flex p-1 -ml-1 text-ink-soft hover:text-ink transition-colors shrink-0"
              aria-label="Open menu"
            >
              <Menu size={16} />
            </button>
            <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-soft truncate">
              HMCR-2026 · Admin Console
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
