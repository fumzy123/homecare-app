import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Kicker } from '@/shared/components/ui'
import { ProfileForm }    from '@/features/account/components/ProfileForm'
import { BillingSection } from '@/features/account/components/BillingSection'
import { AgencySection }  from '@/features/account/components/AgencySection'
import { TeamSection }    from '@/features/account/components/TeamSection'

export const Route = createFileRoute('/_protected/account/')({
  component: AccountPage,
})

type Section = 'profile' | 'agency' | 'billing' | 'team'

const SECTIONS: { id: Section; num: string; label: string; sub: string }[] = [
  { id: 'profile', num: '01', label: 'My Profile',          sub: 'Name & email'           },
  { id: 'agency',  num: '02', label: 'Agency Settings',     sub: 'Organization details'   },
  { id: 'billing', num: '03', label: 'Billing & Licensing', sub: 'Subscription & payments'},
  { id: 'team',    num: '04', label: 'Team & Invitations',  sub: 'Members & access'       },
]

const PANE_HEADER: Record<Section, { num: string; title: string; sub: string }> = {
  profile: { num: '01', title: 'My profile.',           sub: 'Your name and email across the entire console.'              },
  agency:  { num: '02', title: 'Agency settings.',      sub: 'Organization record — affects how the agency is identified.' },
  billing: { num: '03', title: 'Billing & licensing.',  sub: 'Subscription status and payment management via Stripe.'      },
  team:    { num: '04', title: 'Team & invitations.',   sub: 'Everyone with access and pending invite status.'             },
}

function AccountPage() {
  const [active, setActive] = useState<Section>('profile')
  const { num, title, sub } = PANE_HEADER[active]

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

        {/* Sidebar */}
        <aside className="lg:sticky lg:top-6 lg:self-start space-y-4">
          <div className="border border-ink bg-paper">
            <div className="px-4 py-3 border-b border-ink">
              <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft">Sections</p>
            </div>
            <div className="py-1">
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActive(s.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                    active === s.id ? 'bg-ink text-cream' : 'text-ink-soft hover:text-ink hover:bg-cream-2'
                  }`}
                >
                  <span>
                    <span className="font-mono text-[11px] tracking-[0.03em] flex items-center gap-2">
                      <span className={`font-mono text-[9px] ${active === s.id ? 'opacity-50' : 'opacity-40'}`}>{s.num}</span>
                      {s.label}
                    </span>
                    <span className={`font-mono text-[9px] tracking-[0.06em] block mt-0.5 ${active === s.id ? 'opacity-50' : 'opacity-40'}`}>
                      {s.sub}
                    </span>
                  </span>
                  <span className={`font-mono text-[12px] shrink-0 ml-2 ${active === s.id ? 'opacity-100' : 'opacity-20'}`}>→</span>
                </button>
              ))}
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

        {/* Content pane */}
        <div className="min-w-0">
          {/* Pane header */}
          <div className="pb-6 mb-8 border-b border-ink flex items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft mb-2">
                <span className="inline-block w-4 h-px bg-ink align-middle mr-2" />
                Section {num}
              </p>
              <h2 className="font-serif text-[38px] leading-none font-medium tracking-[-0.02em]">
                {title.replace('.', '')} <span className="font-serif italic text-muted">.</span>
              </h2>
              <p className="font-mono text-[11px] text-ink-soft mt-2 max-w-lg">{sub}</p>
            </div>
          </div>

          {active === 'profile' && <ProfileForm />}
          {active === 'agency'  && <AgencySection />}
          {active === 'billing' && <BillingSection />}
          {active === 'team'    && <TeamSection />}
        </div>

      </div>
    </div>
  )
}
