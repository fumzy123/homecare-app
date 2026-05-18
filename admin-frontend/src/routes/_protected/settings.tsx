import { createFileRoute, Outlet, Link, useRouterState } from '@tanstack/react-router'
import { Kicker } from '@/shared/components/ui'

export const Route = createFileRoute('/_protected/settings')({
  component: SettingsLayout,
})

const SECTIONS = [
  { path: '/settings/profile', num: '01', label: 'My Profile',          sub: 'org_members'              },
  { path: '/settings/agency',  num: '02', label: 'Agency Settings',     sub: 'organizations'            },
  { path: '/settings/billing', num: '03', label: 'Billing & Licensing', sub: 'stripe · payments.py'     },
  { path: '/settings/team',    num: '04', label: 'Team & Invitations',  sub: 'org_members · invitations.py' },
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
                      <span>
                        <span className="font-mono text-[11px] tracking-[0.03em] flex items-center gap-2">
                          <span className={`font-mono text-[9px] ${active ? 'opacity-50' : 'opacity-40'}`}>
                            {s.num}
                          </span>
                          {s.label}
                        </span>
                        <span className={`font-mono text-[9px] tracking-[0.06em] block mt-0.5 ${
                          active ? 'opacity-50' : 'opacity-40'
                        }`}>
                          {s.sub}
                        </span>
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

          {/* Help box */}
          <div className="px-4 py-4 border-l-2 border-orange bg-cream-2">
            <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-orange mb-1">Need help?</p>
            <p className="font-mono text-[11px] text-ink-soft leading-relaxed">
              Email{' '}
              <a href="mailto:support@homecareos.com" className="text-ink underline underline-offset-2">
                support@homecareos.com
              </a>
            </p>
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
