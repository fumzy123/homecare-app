import type { BillingStatus, CurrentBillingUsage, UpcomingBilling } from '../api'
import { useAuthStore } from '@/shared/stores/auth'
import { useUpcomingBilling } from '../hooks/useUpcomingBilling'
import { useBillingUsage } from '../hooks/useBillingUsage'
import { billingMoney } from '../utils/usage-format'

const day = (value: string, timezone: string) => new Date(value).toLocaleDateString('en-CA', { timeZone: timezone, month: 'short', day: 'numeric', year: 'numeric' })

// Layer 2: incomplete or unverified obligations never become a confirmed total.
export function BillingPaymentSummary({ status, upcoming, usage, loading, failed, onRetry }: {
  status: BillingStatus; upcoming?: UpcomingBilling; usage?: CurrentBillingUsage
  loading: boolean; failed: boolean; onRetry: () => void
}) {
  const timezone = status.billing_timezone || 'UTC'
  const trial = status.is_trial_active
  const needsPayment = ['incomplete', 'past_due', 'unpaid', 'paused'].includes(status.subscription_status ?? '')
  const base = upcoming?.base
  const current = usage?.state === 'ready' && !usage.trial_preview ? usage : undefined
  const earlier = upcoming?.periods.filter(row => row.id !== current?.period.id) ?? []
  const annual = upcoming?.annual_settlement
  const unresolved = upcoming?.history_needs_review || upcoming?.corrections.length || earlier.some(row => row.state !== 'ready' || row.usage_amount_cents === null || row.currency !== 'cad')
  const currentVerified = current?.period.currency === 'cad'
  const matchingRenewal = Boolean(base?.scheduled_at && current && new Date(base.scheduled_at).getTime() === new Date(current.period.ends_at).getTime())
  // Earlier monthly invoices can be collected separately; do not roll them into a next-payment promise.
  const canEstimate = !loading && !failed && !unresolved && currentVerified && base?.state === 'scheduled'
    && base.amount_cents != null && (annual || (base.interval === 'month' && earlier.length === 0 && matchingRenewal))
  const usageAmount = (current?.usage.estimated_usage_amount_cents ?? 0) + (annual ? earlier.reduce((sum, row) => sum + (row.usage_amount_cents ?? 0), 0) : 0)
  const estimate = canEstimate ? base.amount_cents! + usageAmount : null
  const canceled = status.billing_canceled || status.subscription_status === 'canceled' || base?.state === 'canceled'
  const firstAmount = !failed && !loading && !unresolved && ['first_payment', 'after_trial'].includes(base?.state ?? '') ? base?.amount_cents : null
  const scheduled = annual ? upcoming?.collection_at : current?.period.finalization_eligible_at
  const trialDate = status.trial_ends_at
  const label = needsPayment ? 'Payment needs attention' : canceled ? 'Renewal canceled' : trial ? 'Due today' : 'Next payment · Estimate'

  return <section aria-label="Next payment" className="border border-ink bg-paper p-6 sm:p-8">
    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">{label}</p>
    <p className="mt-5 font-serif text-4xl sm:text-5xl tabular-nums break-words">
      {needsPayment ? 'Payment incomplete' : canceled ? 'No base renewal' : trial ? billingMoney(0) : estimate !== null ? billingMoney(estimate) : loading ? 'Checking…' : 'Not confirmed'}
    </p>
    <p className="mt-5 text-sm">
      {needsPayment ? 'Review your outstanding invoice or finish payment below.'
        : canceled ? 'Outstanding usage and adjustments may still apply.'
          : trial ? firstAmount != null && trialDate ? `First payment: ${billingMoney(firstAmount)} on ${day(trialDate, timezone)}` : trialDate ? `Trial ends ${day(trialDate, timezone)}. First payment details are not yet confirmed.` : 'Select a plan to confirm your first payment.'
            : estimate !== null && scheduled ? `Expected after ${day(scheduled, timezone)}` : 'Check the breakdown and invoice history for pending charges.'}
    </p>
    <p className="mt-3 text-sm text-ink-soft">{trial && !needsPayment ? 'Your remaining trial days are preserved.' : 'Before tax · Your invoice confirms the final amount.'}</p>
    {failed && <p role="alert" className="mt-3 text-sm">Could not verify upcoming charges. <button className="underline" onClick={onRetry}>Retry</button></p>}
    <details className="mt-6 text-sm">
      <summary className="w-fit cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4">View breakdown</summary>
      <div className="mt-4 space-y-3">
        {!canceled && !failed && !loading && base?.amount_cents != null && <div className="flex justify-between gap-4"><span>{trial ? 'First base payment' : base.interval === 'year' ? 'Annual subscription' : 'Monthly subscription'}</span><span>{billingMoney(base.amount_cents)}</span></div>}
        {estimate !== null && !needsPayment && !canceled && <div className="flex justify-between gap-4"><span>{annual ? 'Usage accrued · Includes current estimate' : 'Additional clients · Estimate'}</span><span>{billingMoney(usageAmount)}</span></div>}
        <p className="text-ink-soft">{trial ? 'Trial visits are free and do not carry into paid usage.' : annual ? 'Usage is calculated monthly and collected at year-end. Future usage can increase this estimate.' : 'Collection follows usage finalization and the 72-hour correction window. This is not a guaranteed debit date.'}</p>
        {!trial && !canEstimate && <p className="text-ink-soft">A complete total is not yet confirmed. Earlier usage, outstanding invoices, or adjustments may be processed separately.</p>}
      </div>
    </details>
  </section>
}

// Layer 3: shared query keys reuse the usage section's data and refresh cycle.
export function BillingPaymentCard({ status }: { status: BillingStatus }) {
  const userId = useAuthStore(s => s.user?.id)
  const upcoming = useUpcomingBilling(status.new_billing_flow ? userId : undefined)
  const usage = useBillingUsage(status.new_billing_flow ? userId : undefined, status.billing_timezone, status.subscription_status)
  return <BillingPaymentSummary status={status} upcoming={upcoming.isSuccess ? upcoming.data : undefined}
    usage={usage.isSuccess ? usage.data : undefined} loading={Boolean(status.new_billing_flow) && (upcoming.isPending || (Boolean(status.billing_timezone) && usage.isPending))}
    failed={upcoming.isError || usage.isError} onRetry={() => { void upcoming.refetch(); void usage.refetch() }} />
}
