import { useState, useEffect, useRef } from 'react'
import { useAuthStore } from '@/shared/stores/auth'
import { BillingDialog } from '@/shared/components/BillingDialog'
import type { BillingProfile } from '../api'
import { useBillingProfile } from '../hooks/useBillingProfile'
import { UpdateCardModal } from './UpdateCardModal'
import { BillingPanel } from './BillingPanel'

const button = 'border border-ink px-4 py-2 font-mono text-[10px] tracking-[0.08em] uppercase hover:bg-cream disabled:opacity-40'

function ProfileEditor({ profile, onClose }: { profile: BillingProfile; onClose: () => void }) {
  const user = useAuthStore(s => s.user)
  const { update } = useBillingProfile(user?.id, false)
  const [name, setName] = useState(profile.name)
  const [email, setEmail] = useState(profile.email)
  const [address, setAddress] = useState({ line1: '', line2: '', city: '', state: '', postal_code: '', ...profile.address, country: profile.address.country || 'CA' })
  return <BillingDialog title="Billing information" onClose={onClose} busy={update.isPending}>
    <form className="space-y-4" onSubmit={event => { event.preventDefault(); update.mutate({ name, email, address }, { onSuccess: onClose }) }}>
      <label className="block text-sm">Name<input required maxLength={200} value={name} onChange={e => setName(e.target.value)} className="mt-1 w-full border border-line-soft p-3" /></label>
      <label className="block text-sm">Billing email<input required type="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full border border-line-soft p-3" /></label>
      {([['line1', 'Address'], ['line2', 'Apartment, suite (optional)'], ['city', 'City'], ['state', 'Province / state'], ['postal_code', 'Postal code']] as const).map(([key, label]) =>
        <label key={key} className="block text-sm">{label}<input value={address[key] ?? ''} maxLength={key === 'postal_code' ? 30 : 100}
          onChange={event => setAddress({ ...address, [key]: event.target.value })} className="mt-1 w-full border border-line-soft p-3" /></label>)}
      <label className="block text-sm">Country<select value={address.country} onChange={e => setAddress({ ...address, country: e.target.value })} className="mt-1 w-full border border-line-soft p-3">
        {Array.from(new Set(['CA', 'US', address.country])).filter(Boolean).map(code => <option key={code} value={code}>{new Intl.DisplayNames(['en'], { type: 'region' }).of(code!)}</option>)}
      </select></label>
      {update.isError && <p role="alert" className="text-sm text-orange">Could not save billing information. Please check the fields and try again.</p>}
      <button disabled={update.isPending} className={button}>{update.isPending ? 'Saving…' : 'Save'}</button>
    </form>
  </BillingDialog>
}

export function BillingProfileSection() {
  const user = useAuthStore(s => s.user)
  const { profile, setDefault, remove, confirmSetup } = useBillingProfile(user?.id)
  const returned = useRef(false)
  const completeSetup = confirmSetup.mutate
  useEffect(() => {
    const intent = new URLSearchParams(window.location.search).get('setup_intent')
    if (intent && !returned.current) {
      returned.current = true
      completeSetup(intent, { onSuccess: () => window.history.replaceState(null, '', window.location.pathname) })
    }
  }, [completeSetup])
  const [editor, setEditor] = useState(false)
  const [card, setCard] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const busy = setDefault.isPending || remove.isPending
  if (profile.isPending) return <p role="status">Loading billing information…</p>
  if (profile.isError) return <p role="alert">Could not load billing information. <button className="underline" onClick={() => void profile.refetch()}>Retry</button></p>
  const data = profile.data
  return <>
    {confirmSetup.isError && <p role="alert" className="text-orange">Could not confirm your card. Please add it again.</p>}
    <BillingPanel label="Billing profile" title="Billing information" action={<button className={button} onClick={() => setEditor(true)}>Edit</button>}>
      <dl className="divide-y divide-dashed divide-line-soft">
        {[['Billing email', data.email], ['Name', data.name], ['Billing address', [data.address.line1, data.address.line2, data.address.city, data.address.state, data.address.postal_code, data.address.country].filter(Boolean).join(', ')]].map(([label, value]) => <div key={label} className="py-4 text-sm"><dt className="font-medium">{label}</dt><dd className="mt-1 text-ink-soft">{value || 'Not added'}</dd></div>)}
      </dl>
    </BillingPanel>
    <BillingPanel label="Cards on file" title="Payment methods" action={<button className={button} onClick={() => setCard(true)}>Add new</button>}>
      <div className="divide-y divide-dashed divide-line-soft">
        {!data.cards.length && <p className="py-5 text-sm text-ink-soft">No payment method saved.</p>}
        {data.cards.map(method => <div key={method.id} className="flex flex-wrap items-center justify-between gap-3 py-5 text-sm"><div><p className="capitalize font-medium">{method.brand} ···· {method.last4}</p><p className="mt-1 text-ink-soft">Expires {String(method.exp_month).padStart(2, '0')}/{method.exp_year}</p></div>
          {method.is_default ? <span className="border border-line-soft bg-cream px-3 py-1 font-mono text-[10px] uppercase tracking-wide">Default</span> : <div className="flex flex-wrap gap-3"><button disabled={busy} className={button} onClick={() => setDefault.mutate(method.id)}>Make default</button><button disabled={busy} className={button} onClick={() => setRemoving(method.id)}>Remove</button></div>}
        </div>)}
      </div>
      {(setDefault.isError || remove.isError) && <p role="alert" className="text-sm text-orange">Could not update the payment method. Please refresh and try again.</p>}
    </BillingPanel>
    {editor && <ProfileEditor profile={data} onClose={() => setEditor(false)} />}
    {card && <UpdateCardModal onClose={() => setCard(false)} onSuccess={() => setCard(false)} />}
    {removing && <BillingDialog title="Remove payment method?" busy={remove.isPending} onClose={() => setRemoving(null)}><div className="space-y-4"><p>This card will no longer be available for future payments.</p><button className={button} disabled={remove.isPending} onClick={() => remove.mutate(removing, { onSuccess: () => setRemoving(null) })}>Remove card</button>{remove.isError && <p role="alert">Could not remove this card. Choose another default first.</p>}</div></BillingDialog>}
  </>
}
