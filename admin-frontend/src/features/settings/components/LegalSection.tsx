import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/shared/stores/auth'
import { organizationApi } from '@/features/organization/api'
import { Tag } from '@/shared/components/ui'

const readField = (label: string, value: string) => (
  <div>
    <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft mb-2">{label}</p>
    <p className="font-mono text-[13px] pb-2 border-b border-dashed border-line-soft">{value}</p>
  </div>
)

export function LegalSection() {
  const { user } = useAuthStore()

  const { data: org } = useQuery({
    queryKey: ['organization'],
    queryFn:  organizationApi.getOrganization,
  })

  const termsDate = org?.terms_accepted_at
    ? new Date(org.terms_accepted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      + ' · '
      + new Date(org.terms_accepted_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : '—'

  return (
    <div className="space-y-5">

      {/* ── A · Compliance status ──────────────────────────────────── */}
      <div className="border border-ink bg-paper">
        <div className="flex items-start justify-between px-6 py-4 border-b border-ink">
          <div>
            <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft">A · Compliance status</p>
            <h3 className="font-serif text-[22px] leading-none font-medium mt-1">Legal &amp; terms</h3>
          </div>
          <Tag variant="mint">Read-only</Tag>
        </div>

        {/* Terms metadata */}
        <div className="px-6 py-5 grid grid-cols-3 gap-6 border-b border-dashed border-line-soft">
          {readField('Terms accepted at', termsDate)}
          {readField('Terms version', org?.terms_accepted_version ?? '—')}
          {readField('Accepted by', `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim())}
        </div>

        {/* Document cards */}
        <div className="px-6 py-5 grid grid-cols-3 gap-4">
          {[
            { label: 'Terms of Service', sub: `${org?.terms_accepted_version ?? '—'} · current`, href: '/terms'   },
            { label: 'Privacy Policy',   sub: `${org?.terms_accepted_version ?? '—'} · current`, href: '/privacy' },
            { label: 'DPA',              sub: `${org?.terms_accepted_version ?? '—'} · current`, href: '/dpa'     },
          ].map(({ label, sub, href }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-dashed border-ink p-4 hover:bg-cream-2 transition-colors group"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-mint shrink-0" />
                <span className="font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft">Active</span>
              </div>
              <p className="font-serif text-[18px] leading-tight font-medium group-hover:underline underline-offset-2">{label}</p>
              <p className="font-mono text-[10px] text-ink-soft mt-2">{sub}</p>
            </a>
          ))}
        </div>

        {/* Note */}
        <div className="mx-6 mb-5 px-4 py-3 border-l-2 border-ink bg-cream-2">
          <p className="font-mono text-[10px] text-ink-soft leading-relaxed">
            ＊ If the terms are updated, the agency owner is prompted to re-accept on next sign-in. Historical acceptances are kept for audit.
          </p>
        </div>
      </div>

    </div>
  )
}
