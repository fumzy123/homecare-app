import { useId } from 'react'
import { Check } from 'lucide-react'
import type { OnboardingOptions } from '../api'

const currency = new Intl.NumberFormat('en-CA', {
  style: 'currency', currency: 'CAD', minimumFractionDigits: 0, maximumFractionDigits: 2,
})
const money = (cents: number) => currency.format(cents / 100)
const features = [
  'Recurring shift scheduling',
  'Scheduling conflict detection',
  'Care request broadcasts to your agency’s workers',
  'Client profiles and weekly care requests',
  'Progress notes for every visit',
  'Worker profiles and availability',
  'Worker credential tracking',
  'Worker timesheet exports',
  'Unlimited workers and staff seats',
  'Onboarding included',
]

// Layer 2: presents server-provided terms; selection and checkout belong to the parent.
export function SubscriptionPlans({ plans, interval, onChange, disabled }: {
  plans: OnboardingOptions['plans']; interval: 'month' | 'year';
  onChange: (value: 'month' | 'year') => void; disabled: boolean
}) {
  const id = useId()
  const plan = plans.find(option => option.interval === interval) ?? plans[0]
  if (!plan) return <p role="status">No plans are available right now.</p>
  const monthly = plans.find(option => option.code === plan.code && option.interval === 'month')
  const yearly = plans.find(option => option.code === plan.code && option.interval === 'year')
  const saving = monthly && yearly ? Math.max(0, monthly.base_amount_cents * 12 - yearly.base_amount_cents) : 0
  const annual = plan.interval === 'year'
  const founding = plan.code === 'founding'

  return <div className="mx-auto max-w-3xl space-y-5">
    <h2 className="font-serif text-4xl tracking-tight">Choose how you pay</h2>
    <article className="border border-ink bg-paper" aria-label={`${founding ? 'Founding' : 'Standard'} plan`}>
      <div className="flex flex-wrap items-center justify-between gap-5 border-b border-ink px-6 py-5 sm:px-8">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">{founding ? 'Your founding offer' : 'Care Harbor'}</p>
          <h3 className="mt-1 font-serif text-4xl">{founding ? 'Founding' : 'Standard'}</h3>
        </div>
        {monthly && yearly ? <fieldset disabled={disabled} className="flex border border-ink disabled:opacity-50">
          <legend className="sr-only">Billing frequency</legend>
          {([monthly, yearly]).map(option => <label key={option.interval}
            className={`relative cursor-pointer px-4 py-3 text-sm font-medium has-focus-visible:outline-2 has-focus-visible:outline-offset-4 has-focus-visible:outline-ink ${plan.interval === option.interval ? 'bg-ink text-paper' : 'bg-paper text-ink'} ${disabled ? 'cursor-not-allowed' : ''}`}>
            <input className="sr-only" type="radio" name={`${id}-interval`} value={option.interval} checked={plan.interval === option.interval}
              onChange={() => onChange(option.interval)} />
            {option.interval === 'year' ? 'Yearly' : 'Monthly'}
            {option.interval === 'year' && saving > 0 && <span className="ml-2 text-xs">Save {Math.round(saving / (monthly.base_amount_cents * 12) * 100)}% on base</span>}
          </label>)}
        </fieldset> : <span className="font-mono text-xs uppercase tracking-wide">Monthly billing</span>}
      </div>

      <div className="space-y-5 px-6 py-6 sm:px-8" aria-live="polite" aria-atomic="true">
        <p className="flex flex-wrap items-baseline gap-2">
          <span className="font-serif text-6xl tracking-tight">{money(annual ? plan.base_amount_cents / 12 : plan.base_amount_cents)}</span>
          <span className="text-ink-soft">CAD / month{annual ? ' equivalent' : ''}</span>
        </p>
        <p className="text-sm font-medium">{annual ? `${money(plan.base_amount_cents)} CAD billed annually` : 'Base billed monthly'}</p>
        {annual && saving > 0 && <p className="text-sm text-ink-soft">Save {money(saving)}/year on the base subscription.</p>}
        <p className="text-sm text-ink-soft">{plan.included_clients} active clients included, then {money(plan.additional_client_amount_cents)} per additional client/month. All prices are before tax.</p>
        <div className="border-l-2 border-orange/60 pl-4 text-xs leading-5 text-ink-soft">
          <p className="font-semibold text-ink">How additional-client charges work</p>
          <p className="mt-1">Each monthly billing period includes {plan.included_clients} clients. Each additional client costs {money(plan.additional_client_amount_cents)} CAD for that period, counted once regardless of the number of visits. A client counts when they have at least one scheduled, in-progress, completed or no-show visit in the period. Clients with only cancelled visits do not count.</p>
          <p className="mt-2">{annual
            ? 'Usage is calculated each month and collected at year-end, after the final 72-hour correction window. Your renewal invoice includes the next annual base and the previous year’s usage. If you cancel renewal, a final usage-only invoice follows the end of your prepaid year.'
            : 'Additional-client charges are billed in arrears: after each monthly billing period ends and its 72-hour correction window closes, we automatically charge your saved payment method for that period’s usage, plus applicable tax.'}</p>
        </div>
      </div>

      <div className="space-y-5 border-t border-ink px-6 py-6 sm:px-8">
        <h4 className="text-sm font-semibold text-ink">What’s included</h4>
        <ul className="space-y-4 text-sm leading-6 text-ink">
          {features.map(feature =>
            <li key={feature} className="flex items-start gap-3"><Check size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-ink" /><span>{feature}</span></li>)}
        </ul>
        <p className="border-t border-line-soft pt-4 text-sm text-ink-soft">{annual
          ? 'Cancel renewal anytime. Annual prepayment covers the base only and is non-refundable; access continues through the prepaid year.'
          : 'No minimum commitment. Cancel renewal anytime; access continues through your paid billing period.'}</p>
        {founding && <p className="text-sm text-ink-soft">Rates protected for the first 12 paid months, then Standard rates with at least 30 days’ notice.</p>}
      </div>
    </article>
  </div>
}
