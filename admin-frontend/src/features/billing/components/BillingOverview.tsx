import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type { BillingStatus } from '../api'
import { useBillingOnboarding } from '../hooks/useBillingOnboarding'
import { useAuthStore } from '@/shared/stores/auth'
import { ApiError } from '@/shared/lib/api-client'
import { BillingUsageSection } from './BillingUsageSection'
import { BillingUsageHistorySection, InvoiceHistorySection } from './BillingHistorySection'
import { useEmbeddedBilling } from '../hooks/useEmbeddedBilling'
import { EmbeddedBillingCheckout } from './EmbeddedBillingCheckout'
import { BillingProfileSection } from './BillingProfileSection'
import { UpcomingBillingSection } from './UpcomingBillingSection'
import { ArrowRight, CalendarDays, Check } from 'lucide-react'

const button = 'border border-ink px-4 py-2 font-mono text-[10px] tracking-[0.08em] uppercase hover:bg-cream disabled:opacity-40'
const date = (value: string) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
const money = (value: number) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(value / 100)

// Layer 2: the plan summary only presents supplied state and actions.
export function BillingPlanSummary({ status, owner, busy, onAction }: { status: BillingStatus; owner: boolean; busy: boolean; onAction: () => void }) {
  const subscribed = Boolean(status.subscription_status)
  const needsPayment = ['incomplete', 'past_due', 'unpaid', 'paused'].includes(status.subscription_status ?? '')
  const title = status.is_trial_active ? 'Free trial'
    : status.plan_code === 'founding' ? 'Founding subscription' : subscribed && status.subscription_status !== 'canceled' ? 'Your Care Harbor subscription' : 'Keep care moving.'
  const description = status.subscription_status === 'canceled' ? 'Subscription ended' : status.billing_canceled ? 'Renewal canceled'
    : needsPayment ? 'Payment needs attention'
      : status.is_trial_active && status.trial_ends_at ? `${status.trial_days_left} days left · Ends ${date(status.trial_ends_at)}`
          : status.subscription_current_period_end ? `Current period ends ${date(status.subscription_current_period_end)}`
            : 'Subscribe to continue using Care Harbor.'
  const enrolled = subscribed && status.subscription_status !== 'canceled'
  return <section aria-label="Subscription" className="overflow-hidden rounded-2xl border border-ink/15 bg-paper">
    <div className="grid lg:grid-cols-[1.3fr_1fr]">
      <div className="p-6 sm:p-8">
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">Your subscription</p>
        <h2 className="font-serif text-3xl sm:text-4xl tracking-tight text-ink">{title}</h2>
        <p className={`mt-3 text-sm leading-6 ${needsPayment ? 'font-semibold text-ink' : 'text-ink-soft'}`}>{description}</p>
        <p className="mt-5 max-w-lg text-sm leading-6 text-ink-soft">One plan for your agency. Scheduling, client records and your care team, together in one workspace.</p>
        <div className="mt-4 flex items-center gap-2 text-sm text-ink"><Check size={16} aria-hidden="true" /> Same features with either billing frequency</div>
        {status.base_amount_cents != null && <p className="mt-5 border-t border-ink/10 pt-4 text-sm text-ink-soft">{money(status.base_amount_cents)} CAD / {status.plan_interval === 'year' ? 'year' : 'month'} base · Additional usage billed {status.annual_settlement ? 'annually' : 'monthly'}</p>}
      </div>
      <div className="flex flex-col justify-center border-t border-ink/10 bg-cream/70 p-6 sm:p-8 lg:border-l lg:border-t-0">
        <CalendarDays size={24} strokeWidth={1.5} className="mb-4 text-ink" aria-hidden="true" />
        <h3 className="font-serif text-2xl text-ink">One plan. Two ways to pay.</h3>
        <p className="mt-2 text-sm leading-6 text-ink-soft">Pay monthly or annually. Review pricing and payment details before confirming.</p>
        {owner ? <button type="button" disabled={busy} onClick={onAction}
          className="mt-6 flex min-h-12 w-full items-center justify-between gap-4 rounded-lg bg-ink px-5 py-3 text-sm font-semibold text-paper transition-colors hover:bg-ink/85 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink disabled:cursor-wait disabled:opacity-40">
          {enrolled ? 'Review billing options' : 'Choose billing frequency'}<ArrowRight size={18} aria-hidden="true" />
        </button> : <p className="mt-5 border-t border-ink/10 pt-4 text-sm font-medium text-ink">Your agency owner can manage the subscription.</p>}
      </div>
    </div>
  </section>
}

// Layer 3: account actions stay here; fetching remains in named hooks.
export function BillingOverview({ status }: { status: BillingStatus }) {
  const user = useAuthStore(s => s.user)
  const owner = user?.role === 'owner'
  const navigate = useNavigate()
  const { cancel } = useBillingOnboarding(user?.id, false)
  const { confirm } = useEmbeddedBilling()
  const [paymentSecret, setPaymentSecret] = useState<string | undefined>()
  const finishPayment = () => confirm.mutate(undefined, { onSuccess: result => setPaymentSecret(result.payment_client_secret) })
  const [cancelPrompt, setCancelPrompt] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const returned = useRef(false)
  const confirmCard = confirm.mutate
  useEffect(() => {
    if (!owner || returned.current || new URLSearchParams(window.location.search).get('card_setup') !== 'complete') return
    returned.current = true
    confirmCard()
  }, [owner, confirmCard])
  const busy = confirm.isPending || cancel.isPending
  const error = confirm.error ?? cancel.error
  const subscribed = Boolean(status.subscription_status)
  const conversion = status.founding_conversion
  return <div className="space-y-5">
    <BillingPlanSummary status={status} owner={owner} busy={busy} onAction={() => void navigate({ to: '/upgrade' })} />
    {confirm.isPending && <p role="status" className="text-sm">Confirming your subscription…</p>}
    {error && <p role="alert" className="text-sm text-orange">{error instanceof ApiError ? error.message : 'Could not complete the billing action. Please try again.'}</p>}
    {owner && status.new_billing_flow && ['incomplete', 'past_due', 'unpaid'].includes(status.subscription_status ?? '') &&
      <button className={button} disabled={busy} onClick={finishPayment}>Finish payment</button>}
    {conversion && ['pending', 'scheduled'].includes(conversion.status) && <p role="status" className="text-sm">From {date(conversion.effective_at)}: Standard at {money(conversion.base_amount_cents)} CAD/month + {money(conversion.additional_client_amount_cents)} per additional client.</p>}
    {status.activation_status === 'needs_review' || conversion?.status === 'needs_review'
      ? <p role="alert" className="text-sm text-orange">Your billing setup needs a support review.</p> : null}

    {status.new_billing_flow && (subscribed || status.is_trial_active) && <BillingUsageSection status={status} compact />}
    <InvoiceHistorySection compact />

    {owner && <BillingProfileSection />}
    {paymentSecret && <EmbeddedBillingCheckout paymentSecret={paymentSecret} onComplete={finishPayment} onClose={() => setPaymentSecret(undefined)} />}

    {status.new_billing_flow && subscribed && <details className="border border-ink bg-paper" onToggle={event => setShowHistory(event.currentTarget.open)}>
      <summary className="cursor-pointer px-6 py-4 font-mono text-[11px]">Billing breakdown and usage history</summary>
      {showHistory && <div className="space-y-5 border-t border-ink p-6"><UpcomingBillingSection timezone={status.billing_timezone} /><BillingUsageHistorySection /></div>}
    </details>}
    {owner && status.plan_interval && !status.billing_canceled && <div className="text-sm">
      {cancelPrompt ? <div className="space-y-3"><p>Cancel renewal? Paid access continues until the end of your billing period. Final usage charges may still apply.</p><div className="flex gap-3"><button className={`${button} text-red-700`} disabled={busy} onClick={() => cancel.mutate(undefined, { onSuccess: () => setCancelPrompt(false) })}>Confirm cancellation</button><button className={button} disabled={busy} onClick={() => setCancelPrompt(false)}>Keep subscription</button></div></div>
        : <button className="text-red-700 underline" onClick={() => setCancelPrompt(true)}>Cancel renewal</button>}
    </div>}
  </div>
}
