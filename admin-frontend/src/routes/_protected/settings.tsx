import { createFileRoute, Outlet, Link, useRouterState } from '@tanstack/react-router'
import { Kicker } from '@/shared/components/ui'

export const Route = createFileRoute('/_protected/settings')({
  component: SettingsLayout,
})

const SECTIONS = [
  { path: '/settings/profile', label: 'My Profile'          },
  { path: '/settings/agency',  label: 'Agency Settings'     },
  { path: '/settings/billing', label: 'Billing' },
  { path: '/settings/team',    label: 'Team & Invitations'  },
] as const

function SettingsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <div className="min-h-full bg-cream">

      {/* Page header */}
      <div className="px-10 max-md:px-4 pt-10 pb-8 border-b border-ink">
        <Kicker leader className="mb-4">06 / Settings</Kicker>
        <h1 className="font-serif text-[52px] max-md:text-[36px] leading-[0.98] font-medium tracking-[-0.02em]">
          Settings <span className="font-serif italic text-muted">&amp; preferences.</span>
        </h1>
      </div>

      <div className="px-10 max-md:px-4 py-10 grid grid-cols-[240px_1fr] max-lg:grid-cols-1 gap-8">

        {/* Sidebar nav */}
        <aside className="lg:sticky lg:top-6 lg:self-start space-y-4">
          <div className="border border-ink bg-paper">
            <div className="px-4 py-3 border-b border-ink">
              <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft">Sections</p>
            </div>
            <div className="py-1">
              {SECTIONS.map((s) => {
                const active = pathname.startsWith(s.path)
                return (
                  <Link key={s.path} to={s.path}>
                    <div className={`flex items-center justify-between px-4 py-3 transition-colors ${
                      active ? 'bg-ink text-cream' : 'text-ink-soft hover:text-ink hover:bg-cream-2'
                    }`}>
                      <span className="font-mono text-[11px] tracking-[0.03em]">
                        {s.label}
                      </span>
                      <span className={`font-mono text-[12px] shrink-0 ml-2 ${active ? 'opacity-100' : 'opacity-20'}`}>
                        →
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>

        </aside>

        {/* Active section content */}
        <div className="min-w-0">
          <Outlet />
        </div>

      </div>
    </div>
  )
}
