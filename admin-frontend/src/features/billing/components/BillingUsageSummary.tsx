import type { ReadyBillingUsage, UpcomingBilling } from '../api'
import { usageDate, usageMoney } from '../utils/usage-format'

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
export function BillingUsageSummary({ data, upcoming }: { data: ReadyBillingUsage; upcoming?: UpcomingBilling }) {
  const { period, usage } = data
  const money = (value: number) => usageMoney(value, period.currency)
  const pending = upcoming?.periods ?? []
  const unresolved = upcoming?.history_needs_review || pending.some(row => row.state !== 'ready' || row.usage_amount_cents === null || row.currency !== period.currency)
  const correctionPending = Boolean(upcoming?.corrections.length)
  const annual = upcoming?.annual_settlement
  return <div className="space-y-5">
    <p className="font-mono text-[11px] text-ink-soft">Billing period: {usageDate(period.starts_at, period.agency_timezone)} → {usageDate(period.ends_at, period.agency_timezone)}</p>
    <dl className="grid grid-cols-3 divide-x divide-line-soft">
      {[['Clients counted this billing period', usage.active_client_count], ['Included', period.included_clients], ['Additional', usage.additional_clients]].map(([label, value]) =>
        <div key={label} className="px-3 first:pl-0"><dt className="text-xs sm:text-sm text-ink-soft">{label}</dt><dd className="mt-2 font-serif text-3xl sm:text-4xl tabular-nums">{value}</dd></div>)}
    </dl>
    <div className="border border-ink bg-cream-2 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="font-mono text-[10px] uppercase tracking-[0.08em]">{data.trial_preview ? 'Trial preview · No usage charges' : 'Additional usage · This period'}</p>{!data.trial_preview && <p className="mt-2 text-sm text-ink-soft">{usage.additional_clients} additional clients × {money(period.additional_client_amount_cents)}</p>}</div>
        <p className="font-serif text-4xl tabular-nums">{money(usage.estimated_usage_amount_cents)}</p>
      </div>
      <p className="mt-4 border-t border-line-soft pt-3 text-sm">{data.trial_preview ? 'Trial visits are free. Paid usage starts after your trial.' : annual ? 'Added to your annual usage balance. No monthly usage payment.' : 'Estimated addition to your next bill. Before base subscription and tax.'}</p>
      {!data.trial_preview && <p className="mt-1 text-xs text-ink-soft">Updates as visits change · Final after {usageDate(period.finalization_eligible_at, period.agency_timezone)}</p>}
    </div>
    {upcoming && (annual || pending.length > 0 || unresolved || correctionPending) && <PendingUsageBalance upcoming={upcoming} currency={period.currency} timezone={period.agency_timezone} currentEstimate={usage.estimated_usage_amount_cents} />}
  </div>
}
