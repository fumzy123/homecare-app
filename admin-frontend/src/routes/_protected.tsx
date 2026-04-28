import { createFileRoute, redirect, Outlet } from '@tanstack/react-router'
import { useState } from 'react'
import { format, startOfWeek, endOfWeek } from 'date-fns'
import { Menu } from 'lucide-react'
import { WEEK_STARTS_ON } from '@/shared/lib/date'
import { useAuthStore } from '@/shared/stores/auth'
import { Sidebar } from '@/shared/components/layout/Sidebar'

export const Route = createFileRoute('/_protected')({
  beforeLoad: () => {
    const token = useAuthStore.getState().accessToken
    if (!token) {
      throw redirect({ to: '/login' })
    }
  },
  component: ProtectedLayout,
})

const now      = new Date()
const weekNum  = Math.ceil(
  ((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7
)
const wkStart  = format(startOfWeek(now, { weekStartsOn: WEEK_STARTS_ON }), 'MMM d')
const wkEnd    = format(endOfWeek(now,   { weekStartsOn: WEEK_STARTS_ON }), 'MMM d')

function ProtectedLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

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
