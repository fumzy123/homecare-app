import { useId, useState } from 'react'
import { Btn, Kicker } from '@/shared/components/ui'
import { estimatePricing, pricingMoney, pricingPlans, type PricingPlan } from '../pricing'

export function PricingCalculator() {
  const id = useId()
  const [plan, setPlan] = useState<PricingPlan>('monthly')
  const [clients, setClients] = useState(30)
  const [clientInput, setClientInput] = useState('30')
  const estimate = estimatePricing(plan, clients)
  const invalidCount = clientInput === '' || !/^\d+$/.test(clientInput) || Number(clientInput) > 500

  function updateCount(value: string) {
    setClientInput(value)
    if (/^\d+$/.test(value) && Number(value) <= 500) setClients(Number(value))
  }

  return <section id="pricing" className="scroll-mt-24 py-24 max-md:py-16 px-10 max-md:px-6 border-b border-ink bg-cream">
    <div className="max-w-5xl mx-auto">
      <div className="mb-10 max-w-2xl">
        <Kicker leader className="mb-4">Pricing · All prices in CAD</Kicker>
        <h2 className="font-serif text-[52px] max-md:text-[36px] leading-none font-medium tracking-[-0.02em] mb-5">
          Your agency. <span className="italic">Your estimate.</span>
        </h2>
        <p className="text-ink-soft leading-relaxed">Move the slider to see how active clients affect your price. Every plan includes 10 active clients and unlimited workers and staff seats.</p>
      </div>

      <fieldset className="mb-8">
        <legend className="text-sm mb-3">Choose a plan to estimate</legend>
        <div className="flex flex-wrap gap-3">
          {(Object.keys(pricingPlans) as PricingPlan[]).map(key => <label key={key} className={`cursor-pointer border border-ink px-4 py-3 flex gap-2 items-center ${plan === key ? 'bg-ink text-cream' : 'bg-paper text-ink'}`}>
            <input type="radio" name={`${id}-plan`} value={key} checked={plan === key} onChange={() => setPlan(key)} className="accent-orange focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange" />
            <span className="text-sm">{pricingPlans[key].label}</span>
          </label>)}
        </div>
      </fieldset>

      <div className="grid grid-cols-12 gap-8 items-start">
        <div className="col-span-7 max-md:col-span-12 border border-ink bg-ink text-cream p-8 max-md:p-6">
          <div className="flex items-center justify-between gap-4 mb-5">
            <label htmlFor={`${id}-clients`} className="text-sm">Active clients per month</label>
            <input id={`${id}-clients`} type="number" inputMode="numeric" min={0} max={500} step={1} value={clientInput}
              onChange={event => updateCount(event.target.value)} aria-invalid={invalidCount}
              aria-describedby={`${id}-count-help`} className="w-24 border border-cream/40 bg-transparent px-3 py-2 text-xl text-cream focus-visible:outline-2 focus-visible:outline-orange" />
          </div>
          <label htmlFor={`${id}-slider`} className="sr-only">Adjust active clients</label>
          <input id={`${id}-slider`} type="range" min={0} max={500} step={1} value={clients}
            onChange={event => updateCount(event.target.value)} aria-valuetext={`${clients} active clients`}
            aria-describedby={`${id}-count-help`} className="w-full h-8 cursor-pointer accent-orange focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange" />
          <div className="flex justify-between text-xs text-cream/70 mt-1" aria-hidden="true"><span>0 clients</span><span>250</span><span>500 clients</span></div>
          <p id={`${id}-count-help`} className="text-sm text-cream/80 mt-3">
            {invalidCount ? `Enter a whole number from 0 to 500. The estimate still shows ${clients} clients.` : 'Drag the slider or type an exact count. The first 10 clients are included.'}
          </p>

          <div className="border-t border-cream/20 mt-7 pt-7" aria-live="polite" aria-atomic="true">
            <p className="font-mono text-xs uppercase tracking-wider mb-3">{estimate.label} · {clients} active clients</p>
            {estimate.monthlyTotal !== null ? <>
              <p className="font-serif text-6xl max-sm:text-5xl tracking-tight">{pricingMoney(estimate.monthlyTotal)}<span className="font-sans text-sm tracking-normal text-cream/80"> / month</span></p>
              <p className="text-sm text-cream/80 mt-2">Estimated monthly total before applicable taxes</p>
            </> : <>
              <p className="font-serif text-5xl tracking-tight">{pricingMoney(estimate.base)}<span className="font-sans text-sm tracking-normal text-cream/80"> / year</span></p>
              <p className="font-serif text-3xl mt-3">+ {pricingMoney(estimate.additionalAmount)}<span className="font-sans text-sm text-cream/80"> / month for additional clients</span></p>
              <p className="text-sm text-cream/80 mt-2">Yearly base paid upfront; additional clients billed monthly. Before applicable taxes.</p>
            </>}
            <dl className="space-y-3 text-sm mt-6">
              <div className="flex justify-between gap-3"><dt>Base · 10 clients included</dt><dd className="shrink-0">{pricingMoney(estimate.base)} / {estimate.interval}</dd></div>
              <div className="flex justify-between gap-3"><dt>{estimate.additionalClients} additional clients × {pricingMoney(estimate.extra)}</dt><dd className="shrink-0">{pricingMoney(estimate.additionalAmount)} / month</dd></div>
            </dl>
          </div>
          {plan === 'annual' && <p className="text-sm text-cream/80 mt-6">Save $600 on the annual base subscription. The savings do not apply to additional clients.</p>}
          {plan === 'founding' && <p className="text-sm text-cream/80 mt-6">For the first three customers, subject to availability and approval. Rates protected for your first 12 paid months, then the Standard rates in effect at that time with at least 30 days’ notice. One 30-minute feedback session each month.</p>}
          <Btn variant="orange" className="w-full mt-8 py-4 justify-center" onClick={() => { window.location.href = '/register' }}>Get started</Btn>
          <p className="text-xs text-center text-cream/70 mt-3">Estimate only. Confirm your plan during onboarding.</p>
        </div>

        <div className="col-span-5 max-md:col-span-12 space-y-7">
          <div className="border-l-2 border-orange pl-5">
            <h3 className="font-serif text-2xl mb-2">What counts as active?</h3>
            <p className="text-sm text-ink-soft leading-relaxed">A client counts once if they have at least one qualifying scheduled or completed visit in your monthly billing period. Cancelled visits do not count; no-shows do. Billing periods follow your billing anniversary.</p>
            <p className="text-sm text-ink-soft leading-relaxed mt-3">See the running estimate in Settings → Billing. Usage is finalized three days after each period ends, allowing time for corrections.</p>
          </div>
          <div className="border-l-2 border-orange pl-5">
            <h3 className="font-serif text-2xl mb-2">Personal help getting started</h3>
            <p className="text-sm text-ink-soft leading-relaxed">Onboarding and office training are included, with no setup fees. Registry import includes up to 100 clients and 50 workers; migration scope is agreed with you first.</p>
            <p className="text-sm text-ink-soft leading-relaxed mt-3">Your 14-day trial starts when onboarding is complete, or 30 days after signup, whichever comes first. A card and billing consent are required before activation. Your saved card is charged at trial end unless you cancel renewal.</p>
          </div>
          <div className="border-l-2 border-orange pl-5">
            <h3 className="font-serif text-2xl mb-2">Cancel renewal anytime</h3>
            <p className="text-sm text-ink-soft leading-relaxed">Monthly plans have no minimum commitment. Annual access continues through the prepaid year; prepaid base fees are non-refundable. Final additional-client charges may still apply after cancellation. Service terms apply.</p>
          </div>
        </div>
      </div>
    </div>
  </section>
}
