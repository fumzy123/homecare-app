import assert from 'node:assert/strict'
import path from 'node:path'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const server = await createServer({ configFile: false, server: { middlewareMode: true },
  resolve: { alias: { '@': path.resolve('src') } } })
try {
  const { estimatePricing } = await server.ssrLoadModule('/src/features/landing/pricing.ts')
  for (const [clients, total] of [[0, 35000], [10, 35000], [11, 35500], [30, 45000], [50, 55000], [100, 80000], [500, 280000]]) {
    assert.equal(estimatePricing('monthly', clients).monthlyTotal, total)
  }
  assert.equal(estimatePricing('founding', 30).monthlyTotal, 28000)
  assert.equal(estimatePricing('founding', 50).monthlyTotal, 36000)
  const annual = estimatePricing('annual', 30)
  assert.equal(annual.base, 336000)
  assert.equal(annual.additionalAmount, 10000)
  assert.equal(annual.monthlyTotal, null)
  for (const count of [-1, 1.5, NaN, Infinity, 501]) assert.throws(() => estimatePricing('monthly', count))
  const { PricingCalculator } = await server.ssrLoadModule('/src/features/landing/components/PricingCalculator.tsx')
  const html = renderToStaticMarkup(createElement(PricingCalculator))
  assert.match(html, /\$450/)
  assert.match(html, /20 additional clients/)
  assert.match(html, /type="range"/)
  assert.match(html, /type="number"/)
  assert.match(html, /aria-valuetext="30 active clients"/)
  assert.match(html, /before applicable taxes/)
  assert.match(html, /Care Harbor Standard/)
  assert.match(html, /Yearly - Save 20%/)
  assert.equal((html.match(/type="radio"/g) ?? []).length, 2)
  assert.ok(html.indexOf('$450') < html.indexOf('type="range"'))
  assert.match(html, /Founding/)
  assert.doesNotMatch(html, /700|no credit card required/i)
  console.log('Pricing calculator checks passed: included clients, monthly/founding examples, annual billing separation, limits, and accessible initial markup.')
} finally {
  await server.close()
}
