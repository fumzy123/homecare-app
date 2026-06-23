import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/shared/stores/auth'
import { organizationApi } from '@/features/organization/api'

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

  const updateAuthMode = useMutation({
    mutationFn: (uses: boolean) => organizationApi.updateOrganization({ uses_authorizations: uses }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['organization'] }),
  })

  const isOwner = user?.role === 'owner'

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

      {/* ── C · Care & compliance ──────────────────────────────────── */}
      <div className="border border-ink bg-paper">
        <div className="px-6 py-4 border-b border-ink">
          <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft">C · Care &amp; compliance</p>
          <h3 className="font-serif text-[22px] leading-none font-medium mt-1">How you plan care</h3>
        </div>
        <div className="px-6 py-6 flex items-start justify-between gap-6">
          <div className="max-w-[460px]">
            <p className="font-mono text-[11px] tracking-[0.04em] uppercase text-ink mb-1.5">Funder authorizations</p>
            <p className="text-[13px] text-ink-soft leading-relaxed">
              Turn this on if your agency works with health-authority authorizations — you'll be able to record
              authorized services &amp; hours per client and the care plan will be checked against them. Leave it off
              to use the app as a straightforward scheduler. New clients default to {org?.uses_authorizations ? <b>funded</b> : <b>self-pay</b>}; you can still change it per client.
            </p>
            {!isOwner && (
              <p className="font-mono text-[9px] tracking-[0.06em] uppercase text-muted mt-2">Only the owner can change this</p>
            )}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={org?.uses_authorizations ?? false}
            disabled={!isOwner || updateAuthMode.isPending || !org}
            onClick={() => org && updateAuthMode.mutate(!org.uses_authorizations)}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center border transition-colors disabled:opacity-40 ${
              org?.uses_authorizations ? 'bg-ink border-ink' : 'bg-cream-2 border-line-soft'
            }`}
          >
            <span className={`inline-block h-3 w-3 bg-cream transition-transform ${
              org?.uses_authorizations ? 'translate-x-5' : 'translate-x-1'
            }`} />
          </button>
        </div>
      </div>

    </div>
  )
}
