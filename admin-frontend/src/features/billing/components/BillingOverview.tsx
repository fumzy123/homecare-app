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
import { BillingPaymentCard } from './BillingPaymentSummary'
import { billingMoney } from '../utils/usage-format'

const button = 'border border-ink px-4 py-2 font-mono text-[10px] tracking-[0.08em] uppercase hover:bg-cream disabled:opacity-40'
const date = (value: string) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
const money = (value: number) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(value / 100)

// Layer 2: the plan summary only presents supplied state and actions.
export function BillingPlanSummary({ status, owner, busy, onAction }: { status: BillingStatus; owner: boolean; busy: boolean; onAction: () => void }) {
  const subscribed = Boolean(status.subscription_status)
  const needsPayment = ['incomplete', 'past_due', 'unpaid', 'paused'].includes(status.subscription_status ?? '')
  const enrolled = subscribed && status.subscription_status !== 'canceled'
  const title = status.plan_code === 'founding' ? 'Care Harbor Founding' : status.plan_code === 'standard' ? 'Care Harbor Standard' : 'Choose your plan'
  const description = status.subscription_status === 'canceled' ? 'Subscription ended' : status.billing_canceled ? 'Renewal canceled'
    : needsPayment ? 'Payment needs attention'
      : status.is_trial_active ? `Free trial · ${status.trial_days_left} days left` : enrolled ? 'Active' : 'Subscription not started'
  return <section aria-label="Your plan" className="border border-ink bg-paper p-6 sm:p-8">
    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">Your plan</p>
    <h2 className="mt-5 font-serif text-3xl sm:text-4xl tracking-tight text-ink">{title}</h2>
    <p className="mt-4 text-sm">{description}</p>
    {status.base_amount_cents != null && <p className="mt-4 text-lg">{billingMoney(status.base_amount_cents)} / {status.plan_interval === 'year' ? 'year' : 'month'}</p>}
    <p className="mt-3 text-sm text-ink-soft">10 clients included per monthly billing period</p>
    {status.additional_client_amount_cents != null && <p className="mt-3 text-sm text-ink-soft">{billingMoney(status.additional_client_amount_cents)} per additional client</p>}
    {owner ? <button type="button" disabled={busy} onClick={onAction}
      className="mt-6 bg-ink px-5 py-3 font-mono text-xs text-paper hover:bg-ink/85 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink disabled:opacity-40">
      {enrolled ? 'Manage subscription' : 'Choose billing frequency'}
    </button> : <p className="mt-5 text-sm text-ink-soft">Your agency owner can manage the subscription.</p>}
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
    confirmCard(undefined, { onSuccess: result => setPaymentSecret(result.payment_client_secret) })
  }, [owner, confirmCard])
  const busy = confirm.isPending || cancel.isPending
  const error = confirm.error
  const subscribed = Boolean(status.subscription_status)
  const conversion = status.founding_conversion
  return <div className="space-y-5">
    <div className="grid gap-5 lg:grid-cols-2">
      <BillingPaymentCard status={status} />
      <BillingPlanSummary status={status} owner={owner} busy={busy} onAction={() => void navigate({ to: '/upgrade' })} />
    </div>
    {confirm.isPending && <p role="status" className="text-sm">Confirming your subscription…</p>}
    {error && <p role="alert" className="text-sm text-orange">{error instanceof ApiError ? error.message : 'Could not complete the billing action. Please try again.'}</p>}
    {owner && status.new_billing_flow && ['incomplete', 'past_due', 'unpaid'].includes(status.subscription_status ?? '') &&
      <button className={button} disabled={busy} onClick={finishPayment}>Finish payment</button>}
    {conversion && ['pending', 'scheduled'].includes(conversion.status) && <p role="status" className="text-sm">From {date(conversion.effective_at)}: Standard at {money(conversion.base_amount_cents)} CAD/month + {money(conversion.additional_client_amount_cents)} per additional client.</p>}
    {status.activation_status === 'needs_review' || conversion?.status === 'needs_review'
      ? <p role="alert" className="text-sm text-orange">Your billing setup needs a support review.</p> : null}

    {status.new_billing_flow && (subscribed || status.is_trial_active) && <BillingUsageSection status={status} compact />}
    {owner && <BillingProfileSection />}
    <InvoiceHistorySection compact />
    {paymentSecret && <EmbeddedBillingCheckout paymentSecret={paymentSecret} onComplete={finishPayment} onClose={() => setPaymentSecret(undefined)} />}

    {status.new_billing_flow && subscribed && <details className="border border-ink bg-paper" onToggle={event => setShowHistory(event.currentTarget.open)}>
      <summary className="cursor-pointer px-6 py-4 font-mono text-[11px]">Billing breakdown and usage history</summary>
      {showHistory && <div className="space-y-5 border-t border-ink p-6"><UpcomingBillingSection timezone={status.billing_timezone} /><BillingUsageHistorySection /></div>}
    </details>}
    {owner && status.plan_interval && !status.billing_canceled && status.subscription_status !== 'canceled' && <section aria-label="Cancel plan" className="border border-ink bg-paper p-6 sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif text-2xl text-ink">Cancel plan</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">Stop future renewal. Any paid access continues until the end of your billing period. Final usage charges may still apply.</p>
        </div>
        {!cancelPrompt && <button type="button" className="shrink-0 self-start border border-orange bg-orange/10 px-5 py-3 font-mono text-xs text-ink transition-colors hover:bg-orange/20 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink disabled:opacity-40 sm:self-auto" disabled={busy} onClick={() => { cancel.reset(); setCancelPrompt(true) }}>Cancel plan</button>}
      </div>
      {cancelPrompt && <div className="mt-5 space-y-4 border-t border-line-soft pt-5">
        <p className="text-sm font-medium">Are you sure you want to cancel your plan?</p>
        <div className="flex flex-wrap gap-3">
          <button type="button" className={`${button} border-orange bg-orange/10 hover:bg-orange/20`} disabled={busy} onClick={() => cancel.mutate(undefined, { onSuccess: () => setCancelPrompt(false) })}>{cancel.isPending ? 'Canceling…' : 'Confirm cancellation'}</button>
          <button type="button" className={button} disabled={busy} onClick={() => setCancelPrompt(false)}>Keep subscription</button>
        </div>
        {cancel.isError && <p role="alert" className="text-sm text-orange">Could not cancel your plan. Please try again.</p>}
      </div>}
    </section>}
  </div>
}
