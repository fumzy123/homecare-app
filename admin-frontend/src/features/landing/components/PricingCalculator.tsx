import { useId, useState } from 'react'
import { Kicker } from '@/shared/components/ui'
import { HelpTooltip } from '@/shared/components/HelpTooltip'
import { estimatePricing, pricingMoney, pricingPlans } from '../pricing'

export function PricingCalculator() {
  const id = useId()
  const [plan, setPlan] = useState<'monthly' | 'annual'>('monthly')
  const [clients, setClients] = useState(30)
  const [clientInput, setClientInput] = useState('30')
  const annualSaving = pricingPlans.monthly.base * 12 - pricingPlans.annual.base
  const savingPercent = Math.round(annualSaving / (pricingPlans.monthly.base * 12) * 1000) / 10
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

      <div className="grid grid-cols-12 gap-8 items-start">
        <div className="col-span-7 max-md:col-span-12 border border-ink bg-ink text-cream p-8 max-md:p-6">
          <header className="mb-7 space-y-5">
            <h3 className="font-serif text-3xl">Care Harbor Standard</h3>
            <fieldset className="inline-flex flex-wrap border border-cream/40">
              <legend className="sr-only">Billing frequency</legend>
              {(['monthly', 'annual'] as const).map(value => <label key={value}
                className={`cursor-pointer px-4 py-3 text-sm has-focus-visible:outline-2 has-focus-visible:outline-offset-4 has-focus-visible:outline-orange ${plan === value ? 'bg-cream text-ink' : 'text-cream'}`}>
                <input type="radio" className="sr-only" name={`${id}-plan`} value={value} checked={plan === value} onChange={() => setPlan(value)} />
                {value === 'monthly' ? 'Monthly' : `Yearly - Save ${savingPercent}% on base`}
              </label>)}
            </fieldset>
          </header>
          <div aria-live="polite" aria-atomic="true">
            <p className="font-serif text-6xl max-sm:text-5xl tracking-tight">
              {pricingMoney(estimate.monthlyTotal ?? estimate.base / 12 + estimate.additionalAmount)}
              <span className="font-sans text-sm tracking-normal text-cream/80"> / month{plan === 'annual' ? ' equivalent' : ''}</span>
            </p>
            <dl className="space-y-3 text-sm mt-6">
              <div className="flex justify-between gap-3"><dt>Base · 10 clients included</dt><dd className="shrink-0">{pricingMoney(estimate.base)}{plan === 'annual' ? ' billed annually' : ' / month'}</dd></div>
              <div className="flex justify-between gap-3"><dt>{estimate.additionalClients} additional clients × {pricingMoney(estimate.extra)}</dt><dd className="shrink-0">{pricingMoney(estimate.additionalAmount)} / month</dd></div>
            </dl>
            {plan === 'annual' && <p className="text-xs text-cream/70 mt-3">Additional usage is calculated monthly and collected at year-end.</p>}
          </div>
          <div className="mt-7 border-t border-cream/20 pt-7">
            <div className="flex items-center justify-between gap-4 mb-5">
              <HelpTooltip id={`${id}-count-help`} buttonLabel="About active client pricing" text="Tell us the the amount of active clients you serve monthly and we will tell you the cost. The first 10 clients are included.">
                <label htmlFor={`${id}-clients`} className="text-sm">Active clients per month</label>
              </HelpTooltip>
              <input id={`${id}-clients`} type="number" inputMode="numeric" min={0} max={500} step={1} value={clientInput}
                onChange={event => updateCount(event.target.value)} aria-invalid={invalidCount}
                aria-describedby={`${id}-count-help${invalidCount ? ` ${id}-count-error` : ''}`} className="w-24 border border-cream/40 bg-transparent px-3 py-2 text-xl text-cream focus-visible:outline-2 focus-visible:outline-orange" />
            </div>
            <label htmlFor={`${id}-slider`} className="sr-only">Adjust active clients</label>
            <input id={`${id}-slider`} type="range" min={0} max={500} step={1} value={clients}
              onChange={event => updateCount(event.target.value)} aria-valuetext={`${clients} active clients`}
              aria-describedby={`${id}-count-help`} className="w-full h-8 cursor-pointer accent-orange focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange" />
            <div className="flex justify-between text-xs text-cream/70 mt-1" aria-hidden="true"><span>0 clients</span><span>250</span><span>500 clients</span></div>
            {invalidCount && <p id={`${id}-count-error`} role="alert" className="text-sm text-cream/80 mt-3">
              Enter a whole number from 0 to 500. The estimate still shows {clients} clients.
            </p>}
          </div>
          <a className="flex w-full mt-8 py-4 justify-center border border-orange bg-orange text-ink font-mono text-sm hover:bg-orange/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange" href="/register">Get started</a>
          <p className="text-xs text-center text-cream/70 mt-3">{plan === 'annual' ? 'Estimated monthly equivalent before applicable taxes' : 'Estimated monthly total before applicable taxes'}</p>
        </div>

        <div className="col-span-5 max-md:col-span-12 space-y-7">
          <div className="border-l-2 border-orange pl-5">
            <h3 className="font-serif text-2xl mb-2">Founding offer</h3>
            <p className="text-sm text-ink-soft leading-relaxed">{pricingMoney(pricingPlans.founding.base)}/month including 10 active clients, then {pricingMoney(pricingPlans.founding.extra)} per additional client/month. For the first three customers, subject to availability and approval.</p>
            <p className="text-sm text-ink-soft leading-relaxed mt-3">Monthly only. Rates protected for your first 12 paid months, then Standard rates with at least 30 days' notice. One 30-minute feedback session each month.</p>
          </div>
          <div className="border-l-2 border-orange pl-5">
            <h3 className="font-serif text-2xl mb-2">What counts as active?</h3>
            <p className="text-sm text-ink-soft leading-relaxed">A client counts once if they have at least one qualifying scheduled or completed visit in your monthly billing period. Cancelled visits do not count; no-shows do. Billing periods follow your billing anniversary.</p>
            <p className="text-sm text-ink-soft leading-relaxed mt-3">See the running estimate in Settings → Billing. Usage is finalized three days after each period ends, allowing time for corrections.</p>
          </div>
          <div className="border-l-2 border-orange pl-5">
            <h3 className="font-serif text-2xl mb-2">Personal help getting started</h3>
            <p className="text-sm text-ink-soft leading-relaxed">Onboarding and office training are included, with no setup fees. Registry import includes up to 100 clients and 50 workers; migration scope is agreed with you first.</p>
            <p className="text-sm text-ink-soft leading-relaxed mt-3">Your 14-day trial starts when your agency account is created. Subscribe whenever you are ready and keep your remaining trial days. Your chosen plan is charged at trial end unless you cancel renewal.</p>
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
