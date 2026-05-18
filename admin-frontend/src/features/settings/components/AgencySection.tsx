import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/shared/stores/auth'
import { organizationApi } from '@/features/organization/api'
import { Tag } from '@/shared/components/ui'

export function AgencySection() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()

  const { data: org } = useQuery({
    queryKey: ['organization'],
    queryFn:  organizationApi.getOrganization,
  })

  const [address, setAddress] = useState({
    street:      '',
    city:        '',
    province:    '',
    postal_code: '',
  })

  const [addressInitialised, setAddressInitialised] = useState(false)
  if (org && !addressInitialised) {
    setAddress({
      street:      org.street      ?? '',
      city:        org.city        ?? '',
      province:    org.province    ?? '',
      postal_code: org.postal_code ?? '',
    })
    setAddressInitialised(true)
  }

  const updateAddress = useMutation({
    mutationFn: () => organizationApi.updateOrganization({
      street:      address.street      || undefined,
      city:        address.city        || undefined,
      province:    address.province    || undefined,
      postal_code: address.postal_code || undefined,
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['organization'] }),
  })

  const termsDate = org?.terms_accepted_at
    ? new Date(org.terms_accepted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      + ' · '
      + new Date(org.terms_accepted_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : '—'

  const readField = (label: string, value: string) => (
    <div>
      <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft mb-2">{label}</p>
      <p className="font-mono text-[13px] pb-2 border-b border-dashed border-line-soft">{value}</p>
    </div>
  )

  return (
    <div className="space-y-5">

      {/* ── A · General info ───────────────────────────────────────── */}
      <div className="border border-ink bg-paper">
        <div className="px-6 py-4 border-b border-ink">
          <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft">A · General info</p>
          <h3 className="font-serif text-[22px] leading-none font-medium mt-1">Agency identity</h3>
        </div>
        <div className="px-6 py-6 grid grid-cols-2 gap-x-8 gap-y-5">
          {readField('Organization name', org?.name ?? '—')}
          {readField('Organization ID', org?.id ?? '—')}
          {readField('Owner', `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim())}
          {readField('Your role', user?.role ?? '—')}
        </div>
      </div>

      {/* ── B · Business address ───────────────────────────────────── */}
      <div className="border border-ink bg-paper">
        <div className="px-6 py-4 border-b border-ink">
          <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft">B · Business address</p>
          <h3 className="font-serif text-[22px] leading-none font-medium mt-1">Where you operate</h3>
        </div>
        <div className="px-6 py-6 space-y-4">
          <div>
            <label className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft block mb-1.5">Street</label>
            <input
              value={address.street}
              onChange={(e) => setAddress((a) => ({ ...a, street: e.target.value }))}
              placeholder="123 Main St"
              className="w-full border border-ink bg-cream px-3 py-2 font-mono text-[13px] focus:outline-none focus:ring-1 focus:ring-ink"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft block mb-1.5">City</label>
              <input
                value={address.city}
                onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))}
                placeholder="Toronto"
                className="w-full border border-ink bg-cream px-3 py-2 font-mono text-[13px] focus:outline-none focus:ring-1 focus:ring-ink"
              />
            </div>
            <div>
              <label className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft block mb-1.5">Province</label>
              <input
                value={address.province}
                onChange={(e) => setAddress((a) => ({ ...a, province: e.target.value }))}
                placeholder="ON"
                className="w-full border border-ink bg-cream px-3 py-2 font-mono text-[13px] focus:outline-none focus:ring-1 focus:ring-ink"
              />
            </div>
            <div>
              <label className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft block mb-1.5">Postal code</label>
              <input
                value={address.postal_code}
                onChange={(e) => setAddress((a) => ({ ...a, postal_code: e.target.value }))}
                placeholder="M5V 3A8"
                className="w-full border border-ink bg-cream px-3 py-2 font-mono text-[13px] focus:outline-none focus:ring-1 focus:ring-ink"
              />
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-ink flex justify-end">
          <button
            onClick={() => updateAddress.mutate()}
            disabled={updateAddress.isPending}
            className="bg-ink text-cream font-mono text-[10px] tracking-[0.08em] uppercase px-5 py-2 hover:opacity-80 disabled:opacity-40 transition-opacity"
          >
            {updateAddress.isPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>

      {/* ── C · Compliance status ──────────────────────────────────── */}
      <div className="border border-ink bg-paper">
        <div className="flex items-start justify-between px-6 py-4 border-b border-ink">
          <div>
            <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft">C · Compliance status</p>
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

        {/* Compliance cards */}
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
