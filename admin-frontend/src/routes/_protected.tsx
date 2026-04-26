import { createFileRoute, redirect, Outlet } from '@tanstack/react-router'
import { format, startOfWeek, endOfWeek } from 'date-fns'
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
const wkStart  = format(startOfWeek(now, { weekStartsOn: 1 }), 'MMM d')
const wkEnd    = format(endOfWeek(now,   { weekStartsOn: 1 }), 'MMM d')

function ProtectedLayout() {
  return (
    <div className="flex h-screen bg-cream">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Thin agency info strip */}
        <div className="flex items-center justify-between border-b border-ink px-6 py-1.5 shrink-0 bg-cream">
          <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-soft">
            HMCR-2026 · Admin Console
          </span>
          <div className="flex items-center gap-6 font-mono text-[10px] tracking-[0.1em] uppercase text-ink-soft">
            <span>WK {weekNum} · {wkStart}–{wkEnd} · {now.getFullYear()}</span>
          </div>
        </div>
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
