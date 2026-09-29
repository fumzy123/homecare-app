// Public estimates mirror backend/app/domain/billing.py, Standard version 2 / Founding version 1.
// Checkout always uses server-owned prices and founding eligibility.
export const pricingPlans = {
  monthly: { label: 'Standard monthly', base: 35000, extra: 500, interval: 'month' },
  annual: { label: 'Standard annual', base: 336000, extra: 500, interval: 'year' },
  founding: { label: 'Founding', base: 20000, extra: 400, interval: 'month' },
} as const

export type PricingPlan = keyof typeof pricingPlans

export function estimatePricing(plan: PricingPlan, clients: number) {
  if (!Number.isSafeInteger(clients) || clients < 0 || clients > 500) {
    throw new Error('Choose a whole number of clients between 0 and 500')
  }
  const terms = pricingPlans[plan]
  const additionalClients = Math.max(0, clients - 10)
  const additionalAmount = additionalClients * terms.extra
  return { ...terms, additionalClients, additionalAmount,
    monthlyTotal: terms.interval === 'month' ? terms.base + additionalAmount : null }
}

export const pricingMoney = (cents: number) => new Intl.NumberFormat('en-CA', {
  style: 'currency', currency: 'CAD', maximumFractionDigits: 0,
}).format(cents / 100)
