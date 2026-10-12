import { useAuthStore } from '@/shared/stores/auth'
import { useUpcomingBilling } from '../hooks/useUpcomingBilling'
import { usageDate, usageMoney } from '../utils/usage-format'
import type { UpcomingBilling } from '../api'

// Layer 2: presentation only. Dates are billing boundaries, not promised debit dates.
export function UpcomingBillingDetails({ data, timezone }: { data: UpcomingBilling; timezone: string }) {
  const { base } = data
  return <div className="space-y-5">
    <p className="text-sm text-ink-soft">Amounts are before tax. Your invoice confirms the final amount. {data.annual_settlement ? 'Annual renewal combines your next base subscription and the completed year’s usage.' : 'Corrections may appear separately.'}</p>
    <div className="border border-line-soft p-4 space-y-2">
      <h3 className="font-semibold">{base.state === 'first_payment' || base.state === 'after_trial' ? 'First base payment' : base.interval === 'year' ? 'Next annual base renewal' : 'Next monthly base renewal'}</h3>
      {base.state === 'not_selected' ? <p>Select a plan above to see your base subscription amount.</p>
        : base.state === 'canceled' ? <p>Automatic base renewal is canceled. Outstanding usage and corrections may still be billed.</p>
          : base.state === 'needs_review' ? <p role="status">We cannot confirm the next base payment from the current billing records. Check outstanding invoices or contact Care Harbor.</p>
            : <>
              {base.amount_cents !== null && <p className="font-serif text-2xl">{usageMoney(base.amount_cents, 'cad')}</p>}
              <p>{base.scheduled_at ? `${base.state === 'first_payment' ? 'Trial ends' : 'Renewal date'}: ${usageDate(base.scheduled_at, timezone)}` : 'Due after your 14-day trial. The date will appear when your trial starts.'}</p>
            </>}
      {base.interval === 'year' && <p className="text-sm">{data.annual_settlement ? 'Additional usage is collected at year-end, after the 72-hour correction window.' : 'The annual base is charged once per year. Additional-client usage is billed monthly.'}</p>}
      {base.interval === 'month' && base.state === 'scheduled' && <p className="text-sm">Monthly collection normally waits until the previous usage period is finalized, at least 72 hours after that period ends.</p>}
    </div>
    <div className="space-y-3">
      <h3 className="font-semibold">Completed periods awaiting billing</h3>
      {data.history_needs_review && <p role="alert">Billing history needs review. This list may be incomplete; no complete upcoming total can be confirmed yet.</p>}
      {data.periods.length === 0 && <p>No completed periods awaiting billing are currently recorded.</p>}
      {data.periods.map(period => <div key={period.id} className="border border-line-soft p-4 space-y-2">
        <p>{usageDate(period.starts_at, period.agency_timezone)} → {usageDate(period.ends_at, period.agency_timezone)}</p>
        {period.state === 'needs_review' ? <p>Billing needs a support review before this usage can be collected.</p>
          : period.usage_amount_cents === null ? <>
            <p>Awaiting finalization — amount not yet confirmed.</p>
            <p>Eligible for finalization: {usageDate(period.finalization_eligible_at, period.agency_timezone)}.</p>
          </> : <p>{usageMoney(period.usage_amount_cents, period.currency)} finalized usage{period.adjustment_amount_cents ? ' (includes approved corrections)' : ''} · {data.annual_settlement ? 'collected at year-end' : 'awaiting invoice processing'}.</p>}
      </div>)}
      <p className="text-sm text-ink-soft">Current-period usage is shown separately in Monthly client usage. Finalized amounts already invoiced appear in Invoice history.</p>
    </div>
    <div className="space-y-3">
      <h3 className="font-semibold">Approved corrections still being processed</h3>
      {data.corrections.length === 0 && <p>No approved corrections are awaiting completion.</p>}
      {data.corrections.map(row => <div key={row.id} className="border border-line-soft p-4 space-y-2">
        <p>{row.amount_cents < 0 ? 'Credit / refund' : 'Additional usage charge'}: {usageMoney(Math.abs(row.amount_cents), row.currency)}</p>
        <p>{row.state === 'needs_review' ? 'Support review required.'
          : row.payment_status === 'refund_pending' ? 'Refund processing.'
            : row.state === 'invoiced' ? 'Already invoiced; payment remains outstanding. See Invoice history.'
              : 'Approved; payment or credit processing is not yet complete.'}</p>
      </div>)}
      <p className="text-sm text-ink-soft">Credits may reduce an existing invoice or be refunded. They are not automatically deducted from the next base renewal. See Finalized usage history for correction details.</p>
    </div>
  </div>
}

// Layer 3: owns loading and refresh; query definition lives in the feature hook.
export function UpcomingBillingSection({ timezone }: { timezone?: string | null }) {
  const userId = useAuthStore(s => s.user?.id)
  const query = useUpcomingBilling(userId)
  return <section className="border border-ink bg-paper p-6 space-y-4" aria-label="Upcoming billing">
    <div className="flex flex-wrap justify-between gap-3">
      <h2 className="font-serif text-2xl">Upcoming charges</h2>
      <button className="border border-ink rounded-full px-4 py-2 text-sm disabled:opacity-40" disabled={query.isFetching} onClick={() => void query.refetch()}>Refresh upcoming charges</button>
    </div>
    {query.isPending ? <p role="status">Loading upcoming charges…</p>
      : query.isError ? <p role="alert">Upcoming charges could not be verified. Refresh to try again; previous figures are hidden.</p>
        : <UpcomingBillingDetails data={query.data} timezone={timezone || 'UTC'} />}
  </section>
}
