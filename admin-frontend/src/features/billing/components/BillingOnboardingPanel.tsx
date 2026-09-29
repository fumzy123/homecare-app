import { useState, useEffect, useRef, useId } from 'react'
import { Link } from '@tanstack/react-router'
import { ApiError } from '@/shared/lib/api-client'
import { useEmbeddedBilling } from '../hooks/useEmbeddedBilling'
import { EmbeddedBillingCheckout } from './EmbeddedBillingCheckout'
import { SubscriptionPlans } from './SubscriptionPlans'
import type { BillingStatus } from '../api'
import { useBillingOnboarding } from '../hooks/useBillingOnboarding'
import { useAuthStore } from '@/shared/stores/auth'

function message(error: unknown) {
  return error instanceof ApiError ? error.message : 'Billing is temporarily unavailable. Please try again.'
}

export function BillingOnboardingPanel({ status }: { status: BillingStatus }) {
  const user = useAuthStore(s => s.user)
  const owner = user?.role === 'owner'
  const { options, cancel } = useBillingOnboarding(user?.id, owner)
  const { setup, confirm } = useEmbeddedBilling()
  const [checkout, setCheckout] = useState<{ client_secret?: string; payment_client_secret?: string } | null>(null)
  const finish = () => confirm.mutate(undefined, { onSuccess: result => setCheckout(result.payment_client_secret ? result : null) })
  const checkoutHelpId = useId()
  const [interval, setInterval] = useState<'month' | 'year'>(status.plan_interval ?? 'month')
  const [accepted, setAccepted] = useState(false)
  const [cancelPrompt, setCancelPrompt] = useState(false)
  const returnChecked = useRef(false)
  const confirmCard = confirm.mutate
  useEffect(() => {
    if (!owner || returnChecked.current || new URLSearchParams(window.location.search).get('card_setup') !== 'complete') return
    returnChecked.current = true
    confirmCard()
  }, [owner, confirmCard])
  const error = setup.error ?? confirm.error ?? cancel.error ?? options.error
  const busy = setup.isPending || confirm.isPending || cancel.isPending
  const button = 'border border-ink px-4 py-2 disabled:opacity-40'
  const end = status.trial_ends_at ? new Date(status.trial_ends_at).toLocaleString() : null
  const plan = options.data?.plans.find(p => p.interval === interval)
  const conversion = status.founding_conversion

  async function saveCard() {
    if (!accepted || !options.data || !status.billing_timezone || !plan || busy) return
    try {
      const result = await setup.mutateAsync({ interval, consent_version: options.data.consent_version, accepted: true })
      if (result.client_secret || result.payment_client_secret) setCheckout(result)
      else finish()
    } catch { /* Mutation error is displayed below. */ }
  }

  return (
    <section className="space-y-5 border border-ink bg-paper p-6">
      {conversion && ['pending', 'scheduled'].includes(conversion.status) && <div role="status" className="border border-ink p-4 space-y-2">
        <h3 className="font-semibold">Your move to Standard</h3>
        <p>From {new Date(conversion.effective_at).toLocaleString()}, your base subscription will be CAD ${conversion.base_amount_cents / 100}/month, including {conversion.included_clients} active clients. Additional clients will cost CAD ${conversion.additional_client_amount_cents / 100} each per month.</p>
        <p>Notice issued {new Date(conversion.notice_at).toLocaleDateString()}. You can cancel automatic billing before the change. Your final bill depends on usage and applicable taxes.</p>
      </div>}
      {conversion?.status === 'needs_review' && <p role="status">Your pricing transition needs a support review. Contact Care Harbor to confirm the effective date and rates.</p>}
      <h2 className="font-serif text-3xl">{status.is_trial_active ? `Trial: ${status.trial_days_left} days left` : status.subscription_status === 'active' ? `${status.plan_code === 'founding' ? 'Founding' : 'Standard'} plan` : 'Your subscription'}</h2>
      {end && status.is_trial_active && <p>{status.billing_canceled ? 'Trial access ends' : 'Trial ends; first base payment is due'}: {end}.</p>}
      {end && !status.is_trial_active && !status.is_onboarding && <p>Recorded trial end: {end}. Check your invoices below for payment status.</p>}
      {status.base_amount_cents != null && <p>CAD ${(status.base_amount_cents / 100).toLocaleString()} / {status.plan_interval}. Ten active clients included; then CAD ${((status.additional_client_amount_cents ?? 500) / 100).toLocaleString()} per additional client each month, plus applicable taxes.</p>}
      {status.plan_code === 'founding' && <p>Founding rates are protected for your first 12 paid months. {status.founding_protection_ends_at && `Protection ends ${new Date(status.founding_protection_ends_at).toLocaleString()}. `}We will give at least 30 days’ notice of the standard rates before conversion.</p>}
      {status.billing_canceled && <p role="status">Renewal canceled. Any prepaid access continues to its end date.</p>}
      {status.plan_interval === 'year' && <p>Annual prepayment covers the base subscription only. {status.annual_settlement ? 'Additional usage is collected at year-end.' : 'Additional active clients are billed monthly.'} Cancel renewal anytime; prepaid base fees are non-refundable and access continues through the prepaid year.</p>}
      {status.plan_interval === 'month' && <p>No minimum commitment. Cancel renewal anytime; access continues through any paid billing period.</p>}
      {status.plan_interval && <p>Additional-client usage is finalized three days after each monthly billing period. Final usage charges may still apply after cancellation. All amounts are in CAD, plus applicable taxes.</p>}
      {status.activation_status === 'needs_review' && <p role="status">Your trial needs a support review. Contact Care Harbor before continuing.</p>}
      {!owner && <p>Your agency owner manages plan selection and payment details.</p>}
      {owner && !status.subscription_status && !status.billing_canceled && (
        <div className="space-y-4">
          {options.isPending && <p>Loading billing terms…</p>}
          {options.data && <>
            <SubscriptionPlans plans={options.data.plans} interval={interval} onChange={value => { if (value !== interval) { setInterval(value); setAccepted(false) } }} disabled={busy || Boolean(status.plan_interval)} />
            <p>{status.is_trial_active ? `Nothing due today. Your existing trial ends ${end}.` : 'Your trial has ended. The first base payment is due when you finish subscribing.'} {plan && `Base subscription: CAD $${(plan.base_amount_cents / 100).toLocaleString()} per ${interval}, plus applicable tax. ${interval === 'year' ? 'Additional usage is calculated monthly and collected at year-end.' : 'Additional usage is billed monthly.'}`}</p>
            <div className="space-y-4 rounded-xl border border-line-soft bg-cream p-5 sm:p-6">
              <h3 className="text-lg font-semibold">Confirm your subscription</h3>
              <label className="flex gap-3 items-start"><input type="checkbox" checked={accepted} disabled={busy} onChange={e => setAccepted(e.target.checked)} className="mt-1 size-5 shrink-0 accent-orange" /><span className="text-base leading-relaxed">{options.data.consent_text}</span></label>
              <div id={checkoutHelpId} className="space-y-2 text-sm leading-relaxed" role="status">
                {!status.billing_timezone && <p>Complete your agency setup first: <Link to="/settings/agency" className="font-semibold underline underline-offset-4">save your timezone in Agency settings</Link>, then return here.</p>}
                {!plan && <p>Select an available plan to continue.</p>}
                {!accepted && <p>Check the billing agreement above to enable checkout. Selecting a plan does not accept the billing agreement.</p>}
                {busy && <p>Updating your subscription. Please wait…</p>}
                {accepted && status.billing_timezone && plan && !busy && <p>Ready to enter your payment details.</p>}
              </div>
              <button type="button" aria-describedby={checkoutHelpId} disabled={!accepted || busy || !status.billing_timezone || !plan} onClick={saveCard}
                className="min-h-12 rounded-md border border-ink bg-orange px-6 py-3 text-base font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink">
                {setup.isPending ? 'Loading…' : 'Continue'}
              </button>
            </div>
          </>}
          <p>Already entered your payment details?</p>
          <button className={button} disabled={busy} onClick={finish}>Finish subscription setup</button>
        </div>
      )}
      {status.card_saved && !status.subscription_status && !status.billing_canceled && <p>Your card is saved. Finish subscription setup above to confirm activation.</p>}
      {owner && status.new_billing_flow && ['incomplete', 'past_due', 'unpaid'].includes(status.subscription_status ?? '') && <button className={button} disabled={busy} onClick={finish}>Check payment status / finish payment</button>}
      {owner && status.plan_interval && !status.billing_canceled && (
        cancelPrompt ? <div className="space-y-3"><p>Stop automatic conversion or the next renewal? Existing prepaid coverage remains available.</p><button className={button} disabled={busy} onClick={() => cancel.mutate(undefined, { onSuccess: () => setCancelPrompt(false) })}>Confirm cancellation</button><button className={button} disabled={busy} onClick={() => setCancelPrompt(false)}>Keep subscription</button></div>
          : <button className={button} disabled={busy} onClick={() => setCancelPrompt(true)}>Cancel automatic billing</button>
      )}
      {checkout && <EmbeddedBillingCheckout clientSecret={checkout.client_secret} paymentSecret={checkout.payment_client_secret} onComplete={finish} onClose={() => setCheckout(null)} />}
      {error && <p role="alert" className="text-orange">{message(error)}</p>}
    </section>
  )
}
