import test from 'node:test'
import assert from 'node:assert/strict'
import { estimatePricing } from '../src/features/landing/pricing.ts'

test('current monthly estimates include ten clients', () => {
  assert.equal(estimatePricing('monthly', 10).monthlyTotal, 35000)
  assert.equal(estimatePricing('monthly', 30).monthlyTotal, 55000)
  assert.equal(estimatePricing('founding', 10).monthlyTotal, 20000)
  assert.equal(estimatePricing('founding', 30).monthlyTotal, 30000)
})

test('annual discount applies only to the base', () => {
  const annual = estimatePricing('annual', 20)
  const monthly = estimatePricing('monthly', 20)
  assert.equal(annual.base, 336000)
  assert.equal(annual.base * 100, monthly.base * 12 * 80)
  assert.equal(annual.additionalAmount, 10000)
  assert.equal(annual.additionalAmount, monthly.additionalAmount)
  assert.equal(annual.base + annual.additionalAmount * 4, 376000)
  assert.equal(annual.monthlyTotal, null)
})
