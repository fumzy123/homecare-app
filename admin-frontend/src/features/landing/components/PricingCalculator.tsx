import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { estimatePricing, pricingMoney, pricingPlans } from '../pricing'
import { PricingHelp } from './PricingHelp'

const annualFinePrint =
  'Prices above are before tax. The base is paid annually. The slider estimates additional-client charges for one monthly period: $5 per active client above the included 10. Actual amounts depend on each month’s active-client count. We add those monthly charges together at the end of your subscription year and collect payment after a three-day correction window. The 20% saving applies only to the base.'

// Layer 2: landing-page presentation and local UI interactions.
export function PricingCalculator({
  startPath,
  onOpenAnnualFaq,
}: {
  startPath: '/register' | '/dashboard'
  onOpenAnnualFaq: () => void
}) {
  const [yearly, setYearly] = useState(false)
  const [clients, setClients] = useState(30)
  const [clientInput, setClientInput] = useState('30')
  const invalidCount = !/^\d+$/.test(clientInput) || Number(clientInput) > 500
  function updateClients(value: string) {
    setClientInput(value)
    if (/^\d+$/.test(value) && Number(value) <= 500) setClients(Number(value))
  }
  const estimate = estimatePricing(yearly ? 'annual' : 'monthly', clients)
  const annualSaving = pricingPlans.monthly.base * 12 - pricingPlans.annual.base

  return (
    <section className="pricing-section" id="pricing">
      <div className="wrap pricing-layout">
        <div className="pricing-copy">
          <div className="section-kicker">04 / ROOM TO GROW</div>
          <h2>
            More people.
            <br />
            <em>Same clear pricing.</em>
          </h2>
          <p>
            Pay based on active clients. Bring your whole team, with unlimited
            workers and staff seats included.
          </p>
          <ul className="check-list">
            <li>10 active clients included in your base</li>
            <li>Personal onboarding and office training</li>
            <li>No setup fees</li>
            <li>14-day trial from account creation*</li>
          </ul>
          <a href="#pricing-faq" className="inline-link">
            A few things worth knowing <span>↓</span>
          </a>
          <p className="trial-note">
            *Your trial starts when your agency account is created after email
            verification. Subscribe during the trial to keep your remaining
            days; charges start when it ends unless you cancel renewal.
            Subscribe after the trial and your first payment is due immediately.
          </p>
        </div>
        <div className="pricing-card">
          <div className="price-card-top">
            <span className="micro">STANDARD PLAN</span>
            <span className="micro">CAD · BEFORE TAX</span>
          </div>
          <h3>Your agency. Your estimate.</h3>
          <fieldset className="billing-toggle">
            <legend className="sr-only">Billing frequency</legend>
            <label>
              <input
                type="radio"
                name="billing-frequency"
                value="month"
                checked={yearly === false}
                onChange={() => setYearly(false)}
              />
              <span>Monthly</span>
            </label>
            <label>
              <input
                type="radio"
                name="billing-frequency"
                value="year"
                checked={yearly === true}
                onChange={() => setYearly(true)}
              />
              <span>
                Annually <b>Save 20%</b>
              </span>
            </label>
          </fieldset>
          <div className="price-summary" aria-live="polite" aria-atomic="true">
            <div className="price">
              <span id="price-total">
                {pricingMoney(
                  yearly ? estimate.base / 12 : estimate.monthlyTotal!,
                )}
              </span>
              <small className="price-cadence">
                <span id="price-unit">
                  {yearly ? 'CAD / month base' : 'CAD / month'}
                </span>
                <span id="billing-frequency-label">
                  {yearly ? 'billed annually' : 'billed monthly'}
                </span>
              </small>
            </div>
            <p className="annual-savings" id="annual-savings" hidden={!yearly}>
              Save {pricingMoney(annualSaving)} a year on your base
              subscription.
            </p>
          </div>
          <div
            className="price-breakdown"
            aria-live="polite"
            aria-atomic="true"
          >
            <p>
              <span id="base-label">
                {yearly
                  ? `Base · ${pricingMoney(pricingPlans.monthly.base)} × 12 months`
                  : 'Base · 10 clients included'}
              </span>
              <b id="base-price">
                {pricingMoney(pricingPlans.monthly.base * (yearly ? 12 : 1))}
                {yearly ? '' : ' / month'}
              </b>
            </p>
            <p id="discount-row" hidden={!yearly}>
              <span>20% off the annual base</span>
              <b>−{pricingMoney(annualSaving)}</b>
            </p>
            <p id="prepaid-row" hidden={!yearly}>
              <span>Base paid upfront each year</span>
              <b>{pricingMoney(pricingPlans.annual.base)}</b>
            </p>
            <p>
              <span>
                <span id="extra-label">
                  {estimate.additionalClients} additional clients ×{' '}
                  {pricingMoney(estimate.extra)}
                </span>
              </span>
              <b id="extra-price">
                {pricingMoney(estimate.additionalAmount)} / month
              </b>
            </p>
          </div>
          <div className="client-control">
            <PricingHelp />
            <input
              id="client-count"
              type="number"
              inputMode="numeric"
              min={0}
              max={500}
              step={1}
              value={clientInput}
              onChange={(event) => updateClients(event.target.value)}
              aria-invalid={invalidCount}
              aria-describedby={`client-count-help${invalidCount ? ' client-count-error' : ''}`}
            />
          </div>
          {invalidCount && (
            <p
              id="client-count-error"
              className="client-count-error"
              role="alert"
            >
              Enter a whole number from 0 to 500. The estimate still shows{' '}
              {clients} clients.
            </p>
          )}
          <input
            type="range"
            min="0"
            max="500"
            step="1"
            value={clients}
            id="clients-range"
            aria-label="Adjust active clients"
            aria-describedby="client-count-help"
            onChange={(event) => updateClients(event.target.value)}
            aria-valuetext={`${clients} active clients`}
          />
          <div className="range-labels">
            <span>0 clients</span>
            <span>250</span>
            <span>500 clients</span>
          </div>
          <Link className="button orange" to={startPath}>
            Find your starting point <span>↗</span>
          </Link>
          <p className="price-fineprint" id="price-fineprint">
            <span id="price-fineprint-text">
              {yearly
                ? annualFinePrint
                : 'Monthly estimate before tax. Additional-client usage is billed after each monthly period and its three-day correction window.'}
            </span>{' '}
            <a
              id="annual-faq-link"
              href="#annual-clients-faq"
              hidden={!yearly}
              onClick={onOpenAnnualFaq}
            >
              See an example in the FAQ ↓
            </a>
          </p>
        </div>
      </div>
    </section>
  )
}
