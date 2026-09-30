import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useAuthStore } from '@/shared/stores/auth'
import { useBillingStatus } from '@/features/billing/hooks/useBillingStatus'
import { useUpdateAgencyTimezone } from '../hooks/useAgencyTimezone'
import { browserTimezone } from '../timezones'
import { AgencyTimezoneField } from './AgencyTimezoneField'

// Layer 3: owns loading and saving the agency-wide timezone.
export function AgencyTimezoneSettings() {
  const user = useAuthStore(state => state.user)
  const status = useBillingStatus(user?.id)
  const update = useUpdateAgencyTimezone()
  const [choice, setChoice] = useState<string | null>(null)
  const [suggested] = useState(browserTimezone)
  const saved = status.data?.billing_timezone
  const value = choice ?? saved ?? suggested
  const locked = Boolean(saved && status.data?.subscription_status)
  const owner = user?.role === 'owner'

  return <section className="mt-5 border border-ink bg-paper">
    <div className="border-b border-ink px-6 py-4"><h3 className="font-serif text-2xl">Agency timezone</h3></div>
    <div className="space-y-4 px-6 py-6">
      {status.isPending ? <p role="status">Loading agency timezone…</p> : status.isError ? <p role="alert">Could not load your agency timezone. <button onClick={() => void status.refetch()} className="underline">Try again</button></p> : <>
        {owner && !locked ? <AgencyTimezoneField value={value} disabled={update.isPending} onChange={zone => { setChoice(zone); update.reset() }} />
          : <p>{saved?.replaceAll('_', ' ') ?? 'Not selected'}</p>}
        {locked && <p className="text-sm text-ink-soft">Contact support to change your agency timezone after subscription activation, so existing billing periods stay consistent.</p>}
        {!owner && <p className="text-sm text-ink-soft">Your agency owner manages this setting.</p>}
        {owner && !locked && <button type="button" disabled={!value || value === saved || update.isPending}
          onClick={() => update.mutate(value)} className="border border-ink bg-ink px-5 py-3 font-semibold text-paper disabled:opacity-40">
          {update.isPending ? 'Saving…' : 'Save agency timezone'}
        </button>}
        {update.isSuccess && <p role="status">Agency timezone saved. <Link to="/upgrade" className="font-semibold underline">Continue to plan selection</Link>.</p>}
        {update.isError && <p role="alert" className="text-ink">{update.error instanceof Error ? update.error.message : 'Could not save the timezone. Try again.'}</p>}
      </>}
    </div>
  </section>
}
