import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useAuthStore } from '@/shared/stores/auth'
import { useOperatorAccess, useOperatorAgencies, useOperatorAgency, useOperatorSignOut } from '../hooks/useBillingOperator'
import { ApiError } from '@/shared/lib/api-client'
import { usageDate, usageMoney } from '../utils/usage-format'
import type { OperatorAccess, OperatorAction } from '../operator-api'
import { OperatorCorrectionPanel } from './OperatorCorrectionPanel'

const button = 'border border-ink rounded-full px-4 py-2 text-sm disabled:opacity-40'
const labels: Record<OperatorAction, string> = {
  'trial-activation': 'Complete onboarding and request trial',
  'founding-offer': 'Reserve founding offer',
  'founding-offer/release': 'Release unused founding reservation',
  recheck: 'Recheck Stripe history',
}

export function OperatorBillingLink() {
  const userId = useAuthStore(s => s.user?.id)
  const access = useOperatorAccess(userId)
  return access.data?.is_operator ? <Link to="/billing-operations" className="underline">Open internal billing controls</Link> : null
}

export function BillingOperatorPage() {
  const userId = useAuthStore(s => s.user?.id)
  const access = useOperatorAccess(userId)
  const signOut = useOperatorSignOut()
  return <main className="min-h-screen bg-cream text-ink p-6 max-w-6xl mx-auto space-y-5">
    <div className="flex flex-wrap justify-between gap-3"><Link to="/settings/billing" className="underline">Agency billing</Link>
      <button className={button} disabled={signOut.isPending} onClick={() => signOut.mutate()}>Sign out</button></div>
    {signOut.isError && <p role="alert">Could not sign out. Please try again.</p>}
    <h1 className="font-serif text-3xl">Internal billing controls</h1>
    {access.isPending ? <p>Checking operator access…</p> : access.isError ? <div role="alert">
      <p>{access.error instanceof ApiError && access.error.code === 'FORBIDDEN' ? 'This account is not an authorized billing operator. Agency owner access does not grant operator permissions.' : 'Could not verify operator access.'}</p>
      <button className={button} onClick={() => void access.refetch()}>Retry access check</button>
    </div> : <OperatorWorkspace access={access.data} />}
  </main>
}

function OperatorWorkspace({ access }: { access: OperatorAccess }) {
  const userId = useAuthStore(s => s.user?.id)
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const agencies = useOperatorAgencies(userId, search)
  return <>
    <p className="border border-ink p-4">Onboarding: {access.onboarding_enabled ? 'enabled' : 'disabled'} · Usage settlement: {access.settlement_enabled && access.onboarding_enabled ? 'enabled' : 'disabled'} · Live settlement permission: {access.live_settlement_enabled ? 'enabled' : 'disabled'}</p>
    <form className="flex gap-3 flex-wrap" onSubmit={e => { e.preventDefault(); setSearch(input.trim()); setSelected(null) }}>
      <label>Find an agency <input className="border border-ink p-2" maxLength={100} value={input} onChange={e => setInput(e.target.value)} /></label>
      <button className={button}>Search</button>
      <button className={button} type="button" disabled={agencies.isFetching} onClick={() => void agencies.refetch()}>Refresh agencies</button>
    </form>
    {agencies.isPending && <p>Loading agencies…</p>}
    {agencies.isError && <p role="alert">Could not load agencies. Refresh to retry.</p>}
    {!agencies.isError && <div className="flex flex-wrap gap-2">{agencies.data?.pages.flatMap(page => page.agencies).map(agency => <button key={agency.id} className={`${button} ${selected === agency.id ? 'bg-ink text-cream' : ''}`} onClick={() => setSelected(agency.id)} aria-pressed={selected === agency.id}>
      {agency.name} · {agency.subscription_status ?? 'No subscription'}{agency.deleted_at ? ' · Archived' : ''}
    </button>)}</div>}
    {agencies.data?.pages[0].agencies.length === 0 && <p>No agencies match your search.</p>}
    {agencies.hasNextPage && <button className={button} disabled={agencies.isFetching} onClick={() => void agencies.fetchNextPage()}>Load more agencies</button>}
    {selected && <OperatorAgencyPanel key={selected} org={selected} access={access} />}
  </>
}

function OperatorAgencyPanel({ org, access }: { org: string; access: OperatorAccess }) {
  const userId = useAuthStore(s => s.user?.id)
  const { details, periods, action } = useOperatorAgency(userId, org)
  const [confirm, setConfirm] = useState<OperatorAction | null>(null)
  const [period, setPeriod] = useState<string | null>(null)
  if (details.isPending) return <p>Loading agency…</p>
  if (details.isError) return <div role="alert"><p>Could not load agency.</p><button className={button} onClick={() => void details.refetch()}>Retry</button></div>
  const data = details.data
  const agency = data.organization
  const busy = action.isPending || details.isFetching
  return <section className="border border-ink bg-paper p-6 space-y-5">
    <h2 className="font-serif text-2xl">{agency.name}</h2>
    <p className="text-sm break-all">Agency reference: {agency.id}</p>
    <button className={button} disabled={busy} onClick={() => { void details.refetch(); void periods.refetch() }}>Refresh agency</button>
    <p>Plan: {data.plan ? `${data.plan.code} / ${data.plan.interval}` : 'Not authorized'} · Card: {data.plan?.card_saved ? 'saved' : 'not saved'}{data.plan?.canceled && ' · Renewal canceled'}</p>
    <p>Onboarding: {agency.onboarding_completed_at ? `completed ${new Date(agency.onboarding_completed_at).toLocaleString()}` : 'not marked complete'} · Trial request: {data.activation?.status ?? 'none'}</p>
    {data.activation && <p>Trial requested {new Date(data.activation.requested_at).toLocaleString()} · Stripe attempt: {data.activation.attempted_at ? new Date(data.activation.attempted_at).toLocaleString() : 'not recorded'}.</p>}
    {data.activation && <p>Requested trial window: {new Date(data.activation.starts_at).toLocaleString()} → {new Date(data.activation.ends_at).toLocaleString()}.</p>}
    {agency.trial_ends_at && <p>Confirmed trial end: {new Date(agency.trial_ends_at).toLocaleString()}</p>}
    {data.founding && <p>Founding place {data.founding.slot}: {data.founding.released ? 'released' : data.founding.forfeited ? 'forfeited' : 'reserved / in use'}{data.founding.protection_ends_at && ` · Protected until ${new Date(data.founding.protection_ends_at).toLocaleString()}`}</p>}
    {data.conversion && <p>Move to Standard: {data.conversion.status.replaceAll('_', ' ')} · effective {new Date(data.conversion.effective_at).toLocaleString()} · notice {new Date(data.conversion.notice_at).toLocaleString()}.</p>}
    <div className="flex flex-wrap gap-3">
      <button className={button} disabled={busy || !access.onboarding_enabled || !agency.onboarding_deadline_at || Boolean(agency.deleted_at || agency.onboarding_completed_at)} onClick={() => setConfirm('trial-activation')}>{labels['trial-activation']}</button>
      <button className={button} disabled={busy || !agency.onboarding_deadline_at || Boolean(agency.deleted_at || data.plan || data.founding || agency.subscription_status)} onClick={() => setConfirm('founding-offer')}>{labels['founding-offer']}</button>
      <button className={button} disabled={busy || !data.founding || data.founding.released || Boolean(data.plan || agency.subscription_status || agency.deleted_at)} onClick={() => setConfirm('founding-offer/release')}>{labels['founding-offer/release']}</button>
      <button className={button} disabled={busy || !access.onboarding_enabled || !agency.onboarding_deadline_at} onClick={() => setConfirm('recheck')}>{labels.recheck}</button>
    </div>
    {confirm && <div className="border border-ink p-4 space-y-3" role="group" aria-label="Confirm agency action">
      <p><strong>{labels[confirm]}</strong> for {agency.name}?</p>
      <p>{confirm === 'trial-activation' ? 'Confirm the data import and office training are complete. This requests a 14-day trial, subject to the onboarding backstop and saved card/consent. Existing trial dates are not restarted.'
        : confirm === 'founding-offer' ? 'Reserve one of three founding places: CAD 200/month with ten clients included, then CAD 4 per additional client. Reserve before the owner authorizes a plan.'
          : confirm === 'founding-offer/release' ? 'Release this unused place. This agency cannot reclaim its founding offer afterward.'
            : 'Read Stripe history and reconcile billing periods. This does not directly issue charges, refund payments, or reset failed settlement attempts. Normal enabled billing jobs can process recovered periods afterward.'}</p>
      <button className={button} disabled={busy} onClick={() => action.mutate(confirm, { onSuccess: () => setConfirm(null) })}>Confirm {labels[confirm].toLowerCase()}</button>
      <button className={button} disabled={busy} onClick={() => setConfirm(null)}>Cancel</button>
    </div>}
    {action.isError && <p role="alert">{action.error.message}</p>}
    {action.isSuccess && <p role="status">Request recorded. Review the refreshed status above; a trial request is not confirmation that Stripe activated it.</p>}
    <h3 className="font-semibold">Billing issues and work in progress</h3>
    <p>Last history check: {agency.billing_recovery_checked_at ? new Date(agency.billing_recovery_checked_at).toLocaleString() : 'not recorded'}.</p>
    {agency.billing_recovery_error && <p role="alert" className="break-words">History review: {agency.billing_recovery_error}</p>}
    {data.issues.cutoffs.map(row => <p key={row.starts_at}>Usage cutoff {new Date(row.starts_at).toLocaleDateString()}: {row.reason ?? 'Needs review'}</p>)}
    {data.issues.holds.map(row => <p key={row.invoice_id}>Invoice {row.invoice_id}: {row.state} for usage ending {new Date(row.usage_ends_at).toLocaleString()}.</p>)}
    {data.issues.settlements.map(row => <p key={row.id} className="break-words">Settlement {row.id}: {row.state} · {row.payment_status ?? 'not completed'} · {row.error_code ?? 'No recorded error'}{row.invoice_id && ` · Invoice ${row.invoice_id}`}</p>)}
    {!agency.billing_recovery_error && data.issues.settlements.length + data.issues.cutoffs.length + data.issues.holds.length === 0 && <p>No pending settlement, held invoice, or cutoff issue is recorded.</p>}
    {data.issues.has_more && <p>Showing the most recent 100 entries per category. Use period history for older settlement details.</p>}
    <p className="text-sm text-ink-soft">Review errors against Stripe and the recorded period. Refreshing does not resolve an ambiguous charge. Settlement attempts cannot be reset here.</p>
    <h3 className="font-semibold">Finalized periods</h3>
    {periods.isPending && <p>Loading periods…</p>}
    {periods.isError && <p role="alert">Could not load periods. Refresh the agency to retry.</p>}
    {!periods.isError && periods.data?.pages.flatMap(page => page.periods).map(row => <button key={row.period_id} className={`${button} block w-full text-left`} aria-pressed={period === row.period_id} onClick={() => setPeriod(row.period_id)}>
      {usageDate(row.starts_at, row.agency_timezone)} → {usageDate(row.ends_at, row.agency_timezone)} · {row.active_client_count} clients · {usageMoney(row.usage_amount_cents, row.currency)}
    </button>)}
    {periods.data?.pages[0].periods.length === 0 && <p>No finalized periods yet.</p>}
    {periods.hasNextPage && <button className={button} disabled={periods.isFetching} onClick={() => void periods.fetchNextPage()}>Load older periods</button>}
    {period && <div key={period} className="space-y-2"><p className="break-all">Reviewing {agency.name} · period {period}</p><OperatorCorrectionPanel org={org} period={period} /></div>}
  </section>
}
