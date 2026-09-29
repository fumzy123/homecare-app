import { useId, useState } from 'react'
import type { OnboardingOptions } from '../api'

export function SubscriptionPlans({ plans, interval, onChange, disabled }: {
  plans: OnboardingOptions['plans']; interval: 'month' | 'year';
  onChange: (value: 'month' | 'year') => void; disabled: boolean
}) {
  const id = useId()
  const [clients, setClients] = useState(10)
  const money = (cents: number) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(cents / 100)
  return <div className="space-y-6">
    <fieldset>
      <legend className="font-serif text-3xl mb-4">Choose your plan</legend>
      <div className="grid sm:grid-cols-2 gap-4">
        {plans.map(plan => <label key={plan.interval} className={`block border p-6 cursor-pointer ${interval === plan.interval ? 'border-ink bg-cream' : 'border-line-soft bg-paper'}`}>
          <input type="radio" name={`${id}-plan`} checked={interval === plan.interval} disabled={disabled} onChange={() => onChange(plan.interval)} className="mr-2 accent-orange" />
          <span className="font-semibold">{plan.code === 'founding' ? 'Founding' : 'Standard'} · {plan.interval === 'year' ? 'Annual' : 'Monthly'}</span>
          <p className="font-serif text-4xl mt-4">{money(plan.base_amount_cents)} <span className="text-base">CAD / {plan.interval}</span></p>
          <p className="mt-3">{plan.included_clients} active clients included. Then {money(plan.additional_client_amount_cents)} per additional client each month.</p>
          {plan.interval === 'year' && <p className="mt-2">Save CAD $600 on the annual base. Additional clients billed monthly.</p>}
          {plan.code === 'founding' && <p className="mt-2">Your assigned founding offer: rates protected for the first 12 paid months.</p>}
          <p className="mt-3 text-sm">Unlimited workers and staff seats. Onboarding included.</p>
          <p className="mt-4 font-semibold" aria-live="polite">At {clients} active clients: {plan.interval === 'year'
            ? `${money(plan.base_amount_cents)}/year + ${money(Math.max(0, clients - plan.included_clients) * plan.additional_client_amount_cents)}/month`
            : `${money(plan.base_amount_cents + Math.max(0, clients - plan.included_clients) * plan.additional_client_amount_cents)}/month`}</p>
        </label>)}
      </div>
    </fieldset>
    <label className="block" htmlFor={`${id}-clients`}>Estimate your price: {clients} active clients</label>
    <input id={`${id}-clients`} type="range" min="0" max="500" step="1" value={clients} onChange={e => setClients(Number(e.target.value))} className="w-full accent-orange" />
    <p className="text-sm">Estimates are before tax. Only actual qualifying clients are billed; moving this slider does not change your subscription. Annual prepayment covers the base only.</p>
  </div>
}
