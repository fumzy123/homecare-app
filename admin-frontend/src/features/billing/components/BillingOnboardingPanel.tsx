import { useState, useEffect, useRef } from 'react'
import { isAxiosError } from 'axios'
import type { BillingStatus } from '../api'
import { useBillingOnboarding } from '../hooks/useBillingOnboarding'
import { useAuthStore } from '@/shared/stores/auth'

function message(error: unknown) {
  return isAxiosError(error) ? error.response?.data?.error?.message ?? 'Billing is temporarily unavailable. Please try again.' : 'Please try again.'
}

export function BillingOnboardingPanel({ status }: { status: BillingStatus }) {
  const user = useAuthStore(s => s.user)
  const owner = user?.role === 'owner'
  const { options, setup, confirm, cancel, portal, timezone } = useBillingOnboarding(user?.id, owner)
  const [selectedTimezone, setSelectedTimezone] = useState('')
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
  const error = setup.error ?? confirm.error ?? cancel.error ?? portal.error ?? options.error ?? timezone.error
  const busy = setup.isPending || confirm.isPending || cancel.isPending || portal.isPending || timezone.isPending
  const button = 'border border-ink px-4 py-2 disabled:opacity-40'
  const end = status.trial_ends_at ? new Date(status.trial_ends_at).toLocaleString() : null
  const plan = options.data?.plans.find(p => p.interval === interval)
  const conversion = status.founding_conversion

  async function saveCard() {
    if (!accepted || !options.data) return
    try {
      const result = await setup.mutateAsync({ interval, consent_version: options.data.consent_version, accepted: true })
      if (result.url) window.location.assign(result.url)
    } catch { /* Mutation error is displayed below. */ }
  }

  return (
    <section className="space-y-5 border border-ink bg-paper p-6">
      <div className="space-y-2">
        <p>Agency timezone: {status.billing_timezone ?? 'Not selected'}</p>
        {owner && (!status.billing_timezone || !status.subscription_status) && <>
          <label className="block">Select the timezone used for your agency’s shift times
            <select className="block border border-ink p-2 mt-2 max-w-full" value={selectedTimezone || status.billing_timezone || ''} onChange={e => setSelectedTimezone(e.target.value)} disabled={busy}>
              <option value="" disabled>Choose a timezone</option>
              {options.data?.timezones.map(zone => <option key={zone} value={zone}>{zone.replaceAll('_', ' ')}</option>)}
            </select>
          </label>
          <p>We use this timezone to place visits in the correct billing month. Changes after activation require support review.</p>
          <button className={button} disabled={busy || !selectedTimezone || selectedTimezone === status.billing_timezone} onClick={() => timezone.mutate(selectedTimezone)}>Save agency timezone</button>
        </>}
        {!owner && !status.billing_timezone && <p>Ask your agency owner to select a timezone before billing setup.</p>}
      </div>
      {conversion && ['pending', 'scheduled'].includes(conversion.status) && <div role="status" className="border border-ink p-4 space-y-2">
        <h3 className="font-semibold">Your move to Standard</h3>
        <p>From {new Date(conversion.effective_at).toLocaleString()}, your base subscription will be CAD ${conversion.base_amount_cents / 100}/month, including {conversion.included_clients} active clients. Additional clients will cost CAD ${conversion.additional_client_amount_cents / 100} each per month.</p>
        <p>Notice issued {new Date(conversion.notice_at).toLocaleDateString()}. You can cancel automatic billing before the change. Your final bill depends on usage and applicable taxes.</p>
      </div>}
      {conversion?.status === 'needs_review' && <p role="status">Your pricing transition needs a support review. Contact Care Harbor to confirm the effective date and rates.</p>}
      <h2 className="font-serif text-3xl">{status.is_onboarding ? 'Onboarding' : status.is_trial_active ? `Trial: ${status.trial_days_left} days left` : status.subscription_status === 'active' ? `${status.plan_code === 'founding' ? 'Founding' : 'Standard'} plan` : 'Billing needs attention'}</h2>
      {status.is_onboarding && <p>Your trial starts when onboarding is completed, or by {status.onboarding_deadline_at && new Date(status.onboarding_deadline_at).toLocaleString()}. No countdown runs before then.</p>}
      {end && status.is_trial_active && <p>{status.billing_canceled ? 'Trial access ends' : 'Trial ends; first base payment is due'}: {end}.</p>}
      {end && !status.is_trial_active && <p>Trial ended: {end}. Check your invoices below for payment status.</p>}
      {status.base_amount_cents != null && <p>CAD ${(status.base_amount_cents / 100).toLocaleString()} / {status.plan_interval}. Ten active clients included; then CAD ${((status.additional_client_amount_cents ?? 500) / 100).toLocaleString()} per additional client each month, plus applicable taxes.</p>}
      {status.plan_code === 'founding' && <p>Founding rates are protected for your first 12 paid months. {status.founding_protection_ends_at && `Protection ends ${new Date(status.founding_protection_ends_at).toLocaleString()}. `}We will give at least 30 days’ notice of the standard rates before conversion.</p>}
      {status.billing_canceled && <p role="status">Renewal canceled. Any prepaid access continues to its end date.</p>}
      {status.plan_interval === 'year' && <p>Annual prepayment covers the base subscription only. Additional active clients are billed monthly. Cancel renewal anytime; prepaid base fees are non-refundable and access continues through the prepaid year.</p>}
      {status.plan_interval === 'month' && <p>No minimum commitment. Cancel renewal anytime; access continues through any paid billing period.</p>}
      {status.plan_interval && <p>Additional-client usage is finalized three days after each monthly billing period. Final usage charges may still apply after cancellation. All amounts are in CAD, plus applicable taxes.</p>}
      {status.activation_status === 'needs_review' && <p role="status">Your trial needs a support review. Contact Care Harbor before continuing.</p>}
      {!owner && <p>Your agency owner manages plan selection and payment details.</p>}
      {owner && !status.subscription_status && !status.billing_canceled && !status.card_saved && (
        <div className="space-y-4">
          {options.isPending && <p>Loading billing terms…</p>}
          {options.data && <>
            <label className="block">Base subscription
              <select className="block border border-ink p-2 mt-2" value={interval} onChange={e => { setInterval(e.target.value as 'month' | 'year'); setAccepted(false) }} disabled={busy || Boolean(status.plan_interval)}>
                {options.data.plans.map(p => <option key={p.interval} value={p.interval}>{p.code === 'founding' ? 'Founding' : 'Standard'} · CAD ${(p.base_amount_cents / 100).toLocaleString()} / {p.interval}</option>)}
              </select>
            </label>
            <p>Due today: CAD $0. {plan && `First base payment after your trial: CAD $${(plan.base_amount_cents / 100).toLocaleString()}. ${plan.included_clients} active clients included, then CAD $${plan.additional_client_amount_cents / 100} per additional client per month.`} {interval === 'year' && 'Annual prepayment covers the base only.'}</p>
            <label className="flex gap-3 items-start"><input type="checkbox" checked={accepted} disabled={busy} onChange={e => setAccepted(e.target.checked)} className="mt-1" /><span>{options.data.consent_text}</span></label>
            <button className={button} disabled={!accepted || busy || !status.billing_timezone} onClick={saveCard}>{setup.isPending ? 'Opening secure card setup…' : 'Agree and save card with Stripe'}</button>
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
    </section>
  )
}
