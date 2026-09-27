import { useState, useEffect, useRef } from 'react'
import { isAxiosError } from 'axios'
import type { BillingStatus } from '../api'
import { useBillingOnboarding, useBillingDetails } from '../hooks/useBillingOnboarding'
import { useAuthStore } from '@/shared/stores/auth'

function message(error: unknown) {
  return isAxiosError(error) ? error.response?.data?.error?.message ?? 'Billing is temporarily unavailable. Please try again.' : 'Please try again.'
}

export function BillingOnboardingPanel({ status }: { status: BillingStatus }) {
  const user = useAuthStore(s => s.user)
  const owner = user?.role === 'owner'
  const { options, setup, confirm, cancel, portal } = useBillingOnboarding(user?.id, owner)
  const details = useBillingDetails(user?.id, Boolean(status.card_saved || status.subscription_status))
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
  const error = setup.error ?? confirm.error ?? cancel.error ?? portal.error ?? options.error
  const busy = setup.isPending || confirm.isPending || cancel.isPending || portal.isPending
  const button = 'border border-ink px-4 py-2 disabled:opacity-40'
  const end = status.trial_ends_at ? new Date(status.trial_ends_at).toLocaleString() : null
  const plan = options.data?.plans.find(p => p.interval === interval)

  async function saveCard() {
    if (!accepted || !options.data) return
    try {
      const result = await setup.mutateAsync({ interval, consent_version: options.data.consent_version, accepted: true })
      if (result.url) window.location.assign(result.url)
    } catch { /* Mutation error is displayed below. */ }
  }

  return (
    <section className="space-y-5 border border-ink bg-paper p-6">
      <h2 className="font-serif text-3xl">{status.is_onboarding ? 'Onboarding' : status.is_trial_active ? `Trial: ${status.trial_days_left} days left` : status.subscription_status === 'active' ? 'Standard plan' : 'Billing needs attention'}</h2>
      {status.is_onboarding && <p>Your trial starts when onboarding is completed, or by {status.onboarding_deadline_at && new Date(status.onboarding_deadline_at).toLocaleString()}. No countdown runs before then.</p>}
      {end && <p>{status.billing_canceled ? 'Trial access ends' : 'Trial ends; first base payment is due'}: {end}.</p>}
      {status.base_amount_cents != null && <p>CAD ${(status.base_amount_cents / 100).toLocaleString()} / {status.plan_interval}. Ten active clients included; then CAD $5 per additional client each month, plus applicable taxes.</p>}
      {status.billing_canceled && <p role="status">Renewal canceled. Any prepaid access continues to its end date.</p>}
      {status.activation_status === 'needs_review' && <p role="status">Your trial needs a support review. Contact Care Harbor before continuing.</p>}
      {!owner && <p>Your agency owner manages plan selection and payment details.</p>}
      {owner && !status.subscription_status && !status.billing_canceled && !status.card_saved && (
        <div className="space-y-4">
          {options.isPending && <p>Loading billing terms…</p>}
          {options.data && <>
            <label className="block">Base subscription
              <select className="block border border-ink p-2 mt-2" value={interval} onChange={e => { setInterval(e.target.value as 'month' | 'year'); setAccepted(false) }} disabled={busy || Boolean(status.plan_interval)}>
                {options.data.plans.map(p => <option key={p.interval} value={p.interval}>CAD ${(p.base_amount_cents / 100).toLocaleString()} / {p.interval}</option>)}
              </select>
            </label>
            <p>Due today: CAD $0. {plan && `First base payment after your trial: CAD $${(plan.base_amount_cents / 100).toLocaleString()}.`} Annual prepayment covers the base only; additional clients are billed monthly.</p>
            <label className="flex gap-3 items-start"><input type="checkbox" checked={accepted} disabled={busy} onChange={e => setAccepted(e.target.checked)} className="mt-1" /><span>{options.data.consent_text}</span></label>
            <button className={button} disabled={!accepted || busy} onClick={saveCard}>{setup.isPending ? 'Opening secure card setup…' : 'Agree and save card with Stripe'}</button>
          </>}
          <p>Already finished Stripe card setup?</p>
          <button className={button} disabled={busy} onClick={() => confirm.mutate()}>Check saved card</button>
        </div>
      )}
      {status.card_saved && !status.subscription_status && !status.billing_canceled && <p>Your card is saved. Care Harbor will start the trial when onboarding is complete, or at the onboarding deadline.</p>}
      {owner && status.subscription_status && <button className={button} disabled={busy} onClick={async () => { try { const result = await portal.mutateAsync(); window.location.assign(result.url) } catch { /* Display below. */ } }}>Payment methods and invoices</button>}
      {owner && status.plan_interval && !status.billing_canceled && (
        cancelPrompt ? <div className="space-y-3"><p>Stop automatic conversion or the next renewal? Existing prepaid coverage remains available.</p><button className={button} disabled={busy} onClick={() => cancel.mutate(undefined, { onSuccess: () => setCancelPrompt(false) })}>Confirm cancellation</button><button className={button} disabled={busy} onClick={() => setCancelPrompt(false)}>Keep subscription</button></div>
          : <button className={button} disabled={busy} onClick={() => setCancelPrompt(true)}>Cancel automatic billing</button>
      )}
      {error && <p role="alert" className="text-orange">{message(error)}</p>}
      {details.data?.invoices.length ? <div><h3 className="font-semibold">Invoices</h3>{details.data.invoices.map(inv => <p key={inv.id}><a className="underline" href={inv.hosted_invoice_url} target="_blank" rel="noopener noreferrer">{new Date(inv.created * 1000).toLocaleDateString()} · {inv.status}</a></p>)}</div> : null}
    </section>
  )
}
