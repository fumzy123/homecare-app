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
import { BillingPanel } from './BillingPanel'

const button = 'border border-ink px-4 py-2 font-mono text-[10px] tracking-[0.08em] uppercase hover:bg-cream disabled:opacity-40'
const date = (value: string) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
const money = (value: number) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(value / 100)

// Layer 2: the plan summary only presents supplied state and actions.
export function BillingPlanSummary({ status, owner, busy, onAction }: { status: BillingStatus; owner: boolean; busy: boolean; onAction: () => void }) {
  const subscribed = Boolean(status.subscription_status)
  const needsPayment = ['incomplete', 'past_due', 'unpaid', 'paused'].includes(status.subscription_status ?? '')
  const title = status.is_trial_active ? 'Free trial'
    : status.plan_code === 'founding' ? 'Founding' : subscribed ? 'Standard' : 'Choose a plan'
  const description = status.subscription_status === 'canceled' ? 'Subscription ended' : status.billing_canceled ? 'Renewal canceled'
    : needsPayment ? 'Payment needs attention'
      : status.is_trial_active && status.trial_ends_at ? `${status.trial_days_left} days left · Ends ${date(status.trial_ends_at)}`
          : status.subscription_current_period_end ? `Current period ends ${date(status.subscription_current_period_end)}`
            : 'Subscribe to continue using Care Harbor.'
  return <BillingPanel label="Subscription" title={title} action={owner && <button className={button} disabled={busy} onClick={onAction}>Compare plans</button>}>
    <div className="space-y-1">
      <p className={`text-sm ${needsPayment ? 'text-orange' : 'text-ink-soft'}`}>{description}</p>
      {status.base_amount_cents != null && <p className="text-sm text-ink-soft">{money(status.base_amount_cents)} CAD / {status.plan_interval === 'year' ? 'year' : 'month'} base · Additional usage billed {status.annual_settlement ? 'annually' : 'monthly'}</p>}
    </div>
  </BillingPanel>
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
