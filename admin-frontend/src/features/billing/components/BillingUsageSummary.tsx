import type { ReadyBillingUsage, UpcomingBilling } from '../api'
import { billingMoney, usageDate, usageMoney } from '../utils/usage-format'
import type { ReactNode } from 'react'

// Layer 2: also shown after prepaid access ends, while final usage is pending.
export function PendingUsageBalance({ upcoming, currency = 'cad', timezone = 'UTC', currentEstimate = 0 }: {
  upcoming: UpcomingBilling; currency?: string; timezone?: string; currentEstimate?: number
}) {
  const pending = upcoming.periods
  const unresolved = upcoming.history_needs_review || pending.some(row => row.state !== 'ready' || row.usage_amount_cents === null || row.currency !== currency)
  const correctionPending = Boolean(upcoming.corrections.length)
  const finalized = pending.reduce((total, row) => total + (row.usage_amount_cents ?? 0), 0)
  const money = (value: number) => usageMoney(value, currency)
  return <div className="border-t border-line-soft pt-4 space-y-2 text-sm">
    {unresolved || correctionPending ? <p role="status">Earlier usage or adjustments are still being processed. Your total pending usage charge is not confirmed yet.</p> : <>
      <div className="flex justify-between gap-4"><span>{upcoming.annual_settlement ? 'Finalized usage accrued' : 'Earlier usage awaiting billing'}</span><span className="tabular-nums">{money(finalized)}</span></div>
      <div className="flex flex-wrap justify-between items-end gap-4 border-t border-line-soft pt-4"><span>{upcoming.annual_settlement ? 'Usage to add to your annual invoice' : 'Total usage pending, including this estimate'}</span><span className="font-serif text-3xl tabular-nums">{money(finalized + currentEstimate)}</span></div>
      {upcoming.annual_settlement && <p className="text-xs text-ink-soft">{upcoming.base.state === 'canceled' ? 'Before tax. No base renewal charge.' : 'Includes this period’s estimate. Future usage can increase this amount. Before base subscription and tax.'}</p>}
    </>}
    {upcoming.annual_settlement && upcoming.collection_at && <p>Expected collection: {usageDate(upcoming.collection_at, timezone)}{upcoming.base.state === 'canceled' ? ' · Final usage only; renewal canceled' : ' · Collected with your next base subscription'}</p>}
    {correctionPending && <p className="text-ink-soft">A billing adjustment is being processed. See the breakdown below.</p>}
  </div>
}

// Layer 2: renders verified usage and upcoming obligations supplied by hooks.
export function BillingUsageSummary({ data, upcoming, action }: { data: ReadyBillingUsage; upcoming?: UpcomingBilling; action?: ReactNode }) {
  const { period, usage } = data
  const money = (value: number) => period.currency === 'cad' ? billingMoney(value) : usageMoney(value, period.currency)
  const pending = upcoming?.periods ?? []
  const unresolved = upcoming?.history_needs_review || pending.some(row => row.state !== 'ready' || row.usage_amount_cents === null || row.currency !== period.currency)
  const correctionPending = Boolean(upcoming?.corrections.length)
  const annual = upcoming?.annual_settlement
  return <div className="space-y-5">
    <dl className="grid grid-cols-3 divide-x divide-line-soft border-y border-line-soft py-5">
      {[['Clients counted', usage.active_client_count], ['Included', period.included_clients], ['Additional', usage.additional_clients]].map(([label, value]) =>
        <div key={label} className="px-3 first:pl-0"><dt className="text-xs sm:text-sm text-ink-soft">{label}</dt><dd className="mt-2 font-serif text-3xl sm:text-4xl tabular-nums">{value}</dd></div>)}
    </dl>
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm"><strong className="mr-2 text-xl font-semibold tabular-nums">{money(data.trial_preview ? 0 : usage.estimated_usage_amount_cents)}</strong>{data.trial_preview ? '· Trial visits are free' : 'estimated additional usage'}</p>
        {action}
      </div>
      <p className="mt-3 text-sm text-ink-soft">{data.trial_preview ? 'Trial visits do not carry into paid usage.' : `${usage.additional_clients} additional clients × ${money(period.additional_client_amount_cents)} · Before tax`}</p>
      {annual && !data.trial_preview && <p className="mt-2 text-sm text-ink-soft">Collected at year-end. No monthly usage payment.</p>}
    </div>
    <details className="text-sm">
      <summary className="w-fit cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4">How client usage is counted</summary>
      <div className="mt-3 space-y-3 text-ink-soft">
        <p>Each distinct client counts once when a scheduled, in-progress, completed, or no-show visit starts in this period. Cancelled and dropped visits do not count. No daily proration.</p>
        {!data.trial_preview && <p>Estimates update as visits change. Corrections close {usageDate(period.finalization_eligible_at, period.agency_timezone)}. Later changes need a billing review.</p>}
        <p>Exact period: {usageDate(period.starts_at, period.agency_timezone)} → {usageDate(period.ends_at, period.agency_timezone)}. Visits starting at the end boundary count toward the next period.</p>
      </div>
    </details>
    {!data.trial_preview && upcoming && (annual || pending.length > 0 || unresolved || correctionPending) && <details className="text-sm"><summary className="w-fit cursor-pointer">Pending usage balance</summary><div className="mt-3"><PendingUsageBalance upcoming={upcoming} currency={period.currency} timezone={period.agency_timezone} currentEstimate={usage.estimated_usage_amount_cents} /></div></details>}
  </div>
}
