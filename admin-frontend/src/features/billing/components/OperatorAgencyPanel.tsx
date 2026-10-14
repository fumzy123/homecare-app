import { useState } from 'react'
import { useAuthStore } from '@/shared/stores/auth'
import { useOperatorAgency } from '../hooks/useBillingOperator'
import { usageDate, usageMoney } from '../utils/usage-format'
import type { OperatorAccess, OperatorAction } from '../operator-api'
import { OperatorCorrectionPanel } from './OperatorCorrectionPanel'
import { OperatorBadge, OperatorRefresh } from './OperatorStatus'
import { operatorButton as button } from './operator-styles'

const labels: Record<OperatorAction, string> = {
  'trial-activation': 'Trials start automatically',
  'founding-offer': 'Reserve founding offer',
  'founding-offer/release': 'Release unused founding reservation',
  recheck: 'Recheck Stripe history',
}
export function OperatorAgencyPanel({ org, access }: { org: string; access: OperatorAccess }) {
  const userId = useAuthStore(s => s.user?.id)
  const { details, periods, action } = useOperatorAgency(userId, org)
  const [confirm, setConfirm] = useState<OperatorAction | null>(null)
  const [period, setPeriod] = useState<string | null>(null)
  if (details.isPending) return <p role="status" className="rounded-2xl border border-ink/15 bg-paper p-6">Loading agency…</p>
  if (details.isError) return <div role="alert" className="space-y-3 rounded-2xl border border-ink/15 bg-paper p-6"><p>Could not load agency.</p><button className={button} onClick={() => void details.refetch()}>Retry</button></div>
  const data = details.data
  const agency = data.organization
  const busy = action.isPending || details.isFetching
  return <section aria-label={`${agency.name} billing details`} className="overflow-hidden rounded-2xl border border-ink/15 bg-paper text-sm">
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ink/10 p-6 sm:p-8">
      <div className="min-w-0"><p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">Agency billing workspace</p><h2 className="break-words font-serif text-3xl">{agency.name}</h2><p className="mt-2 break-all text-xs text-ink-soft">Agency reference: {agency.id}</p></div>
      <div className="flex flex-wrap items-center gap-3">{agency.deleted_at && <OperatorBadge>Archived</OperatorBadge>}<OperatorRefresh label="Refresh agency" busy={busy || periods.isFetching} onClick={() => { void details.refetch(); void periods.refetch() }} /></div>
    </div>
    <dl className="grid divide-y divide-ink/10 border-b border-ink/10 bg-cream/40 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      <div className="p-6"><dt className="text-xs text-ink-soft">Authorized plan</dt><dd className="mt-2 font-medium capitalize">{data.plan ? `${data.plan.code} / ${data.plan.interval}` : 'Not authorized'}</dd>{data.plan?.canceled && <dd className="mt-2"><OperatorBadge tone="attention">Renewal canceled</OperatorBadge></dd>}</div>
      <div className="p-6"><dt className="text-xs text-ink-soft">Payment card</dt><dd className="mt-2 font-medium">{data.plan?.card_saved ? 'Card saved' : 'No saved card'}</dd></div>
      <div className="p-6"><dt className="text-xs text-ink-soft">Onboarding</dt><dd className="mt-2 font-medium">{agency.onboarding_completed_at ? `Completed ${new Date(agency.onboarding_completed_at).toLocaleDateString()}` : 'Not marked complete'}</dd></div>
    </dl>
    <div className="grid lg:grid-cols-2">
    <section aria-label="Plan and account actions" className="space-y-4 p-6 sm:p-8">
    <h3 className="font-serif text-2xl">Plan & account</h3>
    <p className="text-ink-soft">Trial request: {data.activation?.status.replaceAll('_', ' ') ?? 'none'}</p>
    {data.activation && <p>Trial requested {new Date(data.activation.requested_at).toLocaleString()} · Stripe attempt: {data.activation.attempted_at ? new Date(data.activation.attempted_at).toLocaleString() : 'not recorded'}.</p>}
    {data.activation && <p>Requested trial window: {new Date(data.activation.starts_at).toLocaleString()} → {new Date(data.activation.ends_at).toLocaleString()}.</p>}
    {agency.trial_ends_at && <p>Confirmed trial end: {new Date(agency.trial_ends_at).toLocaleString()}</p>}
    {data.founding && <p>Founding place {data.founding.slot}: {data.founding.released ? 'released' : data.founding.forfeited ? 'forfeited' : 'reserved / in use'}{data.founding.protection_ends_at && ` · Protected until ${new Date(data.founding.protection_ends_at).toLocaleString()}`}</p>}
    {data.conversion && <p>Move to Standard: {data.conversion.status.replaceAll('_', ' ')} · effective {new Date(data.conversion.effective_at).toLocaleString()} · notice {new Date(data.conversion.notice_at).toLocaleString()}.</p>}
    <div className="flex flex-wrap gap-3">
      <button className={button} disabled={busy || !agency.onboarding_deadline_at || Boolean(agency.deleted_at || data.plan || data.founding || agency.subscription_status)} onClick={() => setConfirm('founding-offer')}>{labels['founding-offer']}</button>
      <button className={button} disabled={busy || !data.founding || data.founding.released || Boolean(data.plan || agency.subscription_status || agency.deleted_at)} onClick={() => setConfirm('founding-offer/release')}>{labels['founding-offer/release']}</button>
      <button className={button} disabled={busy || !access.onboarding_enabled || !agency.onboarding_deadline_at} onClick={() => setConfirm('recheck')}>{labels.recheck}</button>
    </div>
    {confirm && <div className="rounded-xl border border-ink/20 bg-cream p-5 space-y-3" role="group" aria-label="Confirm agency action">
      <p><strong>{labels[confirm]}</strong> for {agency.name}?</p>
      <p>{confirm === 'trial-activation' ? 'Trials start automatically at agency signup; onboarding does not change billing dates.'
        : confirm === 'founding-offer' ? 'Reserve one of three founding places: CAD 200/month with ten clients included, then CAD 5 per additional client. Reserve before the owner authorizes a plan.'
          : confirm === 'founding-offer/release' ? 'Release this unused place. This agency cannot reclaim its founding offer afterward.'
            : 'Read Stripe history and reconcile billing periods. This does not directly issue charges, refund payments, or reset failed settlement attempts. Normal enabled billing jobs can process recovered periods afterward.'}</p>
      <div className="flex flex-wrap gap-2"><button className={`${button} !bg-ink !text-paper`} disabled={busy} onClick={() => action.mutate(confirm, { onSuccess: () => setConfirm(null) })}>Confirm {labels[confirm].toLowerCase()}</button>
      <button className={button} disabled={busy} onClick={() => setConfirm(null)}>Cancel</button></div>
    </div>}
    {action.isError && <p role="alert">{action.error.message}</p>}
    {action.isSuccess && <p role="status">Request recorded. Review the refreshed status above; a trial request is not confirmation that Stripe activated it.</p>}
    </section>
    <section aria-label="Billing issues" className="space-y-4 border-t border-ink/10 p-6 sm:p-8 lg:border-l lg:border-t-0">
    <h3 className="font-serif text-2xl">Billing issues & activity</h3>
    <p>Last history check: {agency.billing_recovery_checked_at ? new Date(agency.billing_recovery_checked_at).toLocaleString() : 'not recorded'}.</p>
    {agency.billing_recovery_error && <p role="alert" className="break-words">History review: {agency.billing_recovery_error}</p>}
    {data.issues.cutoffs.map(row => <p key={row.starts_at}>Usage cutoff {new Date(row.starts_at).toLocaleDateString()}: {row.reason ?? 'Needs review'}</p>)}
    {data.issues.holds.map(row => <p key={row.invoice_id}>Invoice {row.invoice_id}: {row.state} for usage ending {new Date(row.usage_ends_at).toLocaleString()}.</p>)}
    {data.issues.settlements.map(row => <p key={row.id} className="break-words">Settlement {row.id}: {row.state} · {row.payment_status ?? 'not completed'} · {row.error_code ?? 'No recorded error'}{row.invoice_id && ` · Invoice ${row.invoice_id}`}</p>)}
    {!agency.billing_recovery_error && data.issues.settlements.length + data.issues.cutoffs.length + data.issues.holds.length === 0 && <p>No pending settlement, held invoice, or cutoff issue is recorded.</p>}
    {data.issues.has_more && <p>Showing the most recent 100 entries per category. Use period history for older settlement details.</p>}
    <p className="text-sm text-ink-soft">Review errors against Stripe and the recorded period. Refreshing does not resolve an ambiguous charge. Settlement attempts cannot be reset here.</p>
    </section>
    </div>
    <section aria-label="Finalized periods" className="space-y-4 border-t border-ink/10 p-6 sm:p-8">
    <div><h3 className="font-serif text-2xl">Finalized periods</h3><p className="mt-1 text-xs text-ink-soft">Select a period to review usage, corrections, and settlement records.</p></div>
    {periods.isPending && <p>Loading periods…</p>}
    {periods.isError && <p role="alert">Could not load periods. Refresh the agency to retry.</p>}
    {!periods.isError && periods.data?.pages.flatMap(page => page.periods).map(row => <button key={row.period_id} className={`${button} w-full !justify-between flex-wrap text-left ${period === row.period_id ? '!border-ink !bg-mint-soft' : ''}`} aria-pressed={period === row.period_id} onClick={() => setPeriod(row.period_id)}>
      <span>{usageDate(row.starts_at, row.agency_timezone)} → {usageDate(row.ends_at, row.agency_timezone)}</span><span className="text-ink-soft">{row.active_client_count} clients</span><span className="font-semibold">{usageMoney(row.usage_amount_cents, row.currency)}</span>
    </button>)}
    {!periods.isError && periods.data?.pages[0].periods.length === 0 && <p className="rounded-lg bg-cream p-4 text-ink-soft">No finalized periods yet.</p>}
    {periods.hasNextPage && <button className={button} disabled={periods.isFetching} onClick={() => void periods.fetchNextPage()}>Load older periods</button>}
    {period && <div key={period} className="space-y-2"><p className="break-all">Reviewing {agency.name} · period {period}</p><OperatorCorrectionPanel org={org} period={period} /></div>}
    </section>
  </section>
}

