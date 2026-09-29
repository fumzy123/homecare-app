import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type { BillingStatus } from '../api'
import { useBillingDetails, useBillingOnboarding } from '../hooks/useBillingOnboarding'
import { useAuthStore } from '@/shared/stores/auth'
import { ApiError } from '@/shared/lib/api-client'
import { BillingUsageSection } from './BillingUsageSection'
import { BillingUsageHistorySection, InvoiceHistorySection } from './BillingHistorySection'
import { UpcomingBillingSection } from './UpcomingBillingSection'

const button = 'rounded-full border border-line-soft px-4 py-2 text-sm font-medium hover:bg-cream disabled:opacity-40'
const date = (value: string) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
const money = (value: number) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(value / 100)

// Layer 2: the plan summary only presents supplied state and actions.
export function BillingPlanSummary({ status, owner, busy, onAction }: { status: BillingStatus; owner: boolean; busy: boolean; onAction: () => void }) {
  const subscribed = Boolean(status.subscription_status)
  const needsPayment = ['incomplete', 'past_due', 'unpaid', 'paused'].includes(status.subscription_status ?? '')
  const title = status.is_onboarding ? 'Onboarding' : status.is_trial_active ? 'Free trial'
    : status.plan_code === 'founding' ? 'Founding' : subscribed ? 'Standard' : 'Choose a plan'
  const description = status.subscription_status === 'canceled' ? 'Subscription ended' : status.billing_canceled ? 'Renewal canceled'
    : needsPayment ? 'Payment needs attention'
      : status.is_trial_active && status.trial_ends_at ? `${status.trial_days_left} days left · Ends ${date(status.trial_ends_at)}`
        : status.is_onboarding ? 'Your 14-day trial starts after onboarding.'
          : status.subscription_current_period_end ? `Current period ends ${date(status.subscription_current_period_end)}`
            : 'Subscribe to continue using Care Harbor.'
  return <section className="rounded-xl border border-line-soft bg-paper p-6 flex flex-wrap items-center justify-between gap-5" aria-label="Your plan">
    <div className="space-y-1">
      <h2 className="font-semibold text-lg">{title}</h2>
      <p className={`text-sm ${needsPayment ? 'text-orange' : 'text-ink-soft'}`}>{description}</p>
      {status.base_amount_cents != null && <p className="text-sm text-ink-soft">{money(status.base_amount_cents)} CAD / {status.plan_interval === 'year' ? 'year' : 'month'} base · Additional usage billed monthly</p>}
    </div>
    {owner && <button className={button} disabled={busy} onClick={onAction}>{subscribed ? 'Manage subscription' : 'View plans'}</button>}
  </section>
}

// Layer 3: account actions stay here; fetching remains in named hooks.
export function BillingOverview({ status }: { status: BillingStatus }) {
  const user = useAuthStore(s => s.user)
  const owner = user?.role === 'owner'
  const navigate = useNavigate()
  const { confirm, cancel, portal } = useBillingOnboarding(user?.id, false)
  const details = useBillingDetails(user?.id, Boolean(status.subscription_status || status.card_saved))
  const [cancelPrompt, setCancelPrompt] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const returned = useRef(false)
  const confirmCard = confirm.mutate
  useEffect(() => {
    if (!owner || returned.current || new URLSearchParams(window.location.search).get('card_setup') !== 'complete') return
    returned.current = true
    confirmCard()
  }, [owner, confirmCard])
  const busy = confirm.isPending || cancel.isPending || portal.isPending
  const error = confirm.error ?? cancel.error ?? portal.error
  const subscribed = Boolean(status.subscription_status)
  const openPortal = async () => {
    try { const result = await portal.mutateAsync(); window.location.assign(result.url) } catch { /* Shown below. */ }
  }
  const card = details.data?.card
  const conversion = status.founding_conversion
  return <div className="max-w-5xl space-y-8">
    <BillingPlanSummary status={status} owner={owner} busy={busy} onAction={() => subscribed ? void openPortal() : void navigate({ to: '/upgrade' })} />
    {confirm.isPending && <p role="status" className="text-sm">Confirming your subscription…</p>}
    {error && <p role="alert" className="text-sm text-orange">{error instanceof ApiError ? error.message : 'Could not complete the billing action. Please try again.'}</p>}
    {owner && status.new_billing_flow && ['incomplete', 'past_due', 'unpaid'].includes(status.subscription_status ?? '') &&
      <button className={button} disabled={busy} onClick={() => confirm.mutate()}>Finish payment</button>}
    {conversion && ['pending', 'scheduled'].includes(conversion.status) && <p role="status" className="text-sm">From {date(conversion.effective_at)}: Standard at {money(conversion.base_amount_cents)} CAD/month + {money(conversion.additional_client_amount_cents)} per additional client.</p>}
    {status.activation_status === 'needs_review' || conversion?.status === 'needs_review'
      ? <p role="alert" className="text-sm text-orange">Your billing setup needs a support review.</p> : null}

    {status.new_billing_flow && subscribed && <BillingUsageSection status={status} compact />}
    <InvoiceHistorySection compact />

    <section className="space-y-4" aria-label="Payment method">
      <div className="flex items-center justify-between gap-4"><h2 className="font-semibold text-lg">Payment method</h2>
        {owner && <button className={button} disabled={busy} onClick={() => subscribed || status.card_saved ? void openPortal() : void navigate({ to: '/upgrade' })}>{card ? 'Edit' : 'Add payment method'}</button>}
      </div>
      <div className="rounded-xl border border-line-soft bg-paper p-5 text-sm">
        {details.isError ? <p role="alert">Could not load payment details. <button className="underline" onClick={() => void details.refetch()}>Retry</button></p>
          : details.isFetching && !details.data ? <p>Loading payment details…</p>
            : card ? <div className="flex justify-between gap-4"><span className="capitalize">{card.brand} ···· {card.last4}</span><span className="text-ink-soft">Expires {String(card.exp_month).padStart(2, '0')}/{card.exp_year}</span></div>
              : <p className="text-ink-soft">No payment method saved.</p>}
      </div>
    </section>

    {status.new_billing_flow && subscribed && <details className="border-t border-line-soft pt-5" onToggle={event => setShowHistory(event.currentTarget.open)}>
      <summary className="cursor-pointer text-sm font-medium">Billing breakdown and usage history</summary>
      {showHistory && <div className="space-y-6 mt-5"><UpcomingBillingSection timezone={status.billing_timezone} /><BillingUsageHistorySection /></div>}
    </details>}
    {owner && status.plan_interval && !status.billing_canceled && <div className="text-sm">
      {cancelPrompt ? <div className="space-y-3"><p>Cancel renewal? Paid access continues until the end of your billing period. Final usage charges may still apply.</p><div className="flex gap-3"><button className={button} disabled={busy} onClick={() => cancel.mutate(undefined, { onSuccess: () => setCancelPrompt(false) })}>Confirm cancellation</button><button className={button} disabled={busy} onClick={() => setCancelPrompt(false)}>Keep subscription</button></div></div>
        : <button className="text-ink-soft underline" onClick={() => setCancelPrompt(true)}>Cancel renewal</button>}
    </div>}
  </div>
}
