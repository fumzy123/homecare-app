// Dependency-free rendering checks using the project's existing TypeScript/React.
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cache = join(root, 'node_modules', '.cache')
mkdirSync(cache, { recursive: true })
const scratch = mkdtempSync(join(cache, 'billing-usage-'))
try {
  for (const [input, output] of [
    ['src/features/billing/utils/usage-format.ts', 'usage-format.mjs'],
    ['src/features/billing/components/BillingUsageDetails.tsx', 'details.mjs'],
  ]) {
    const source = readFileSync(join(root, input), 'utf8').replace('../utils/usage-format', './usage-format.mjs')
    const compiled = ts.transpileModule(source, { fileName: input, compilerOptions: {
      module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX,
    } })
    writeFileSync(join(scratch, output), compiled.outputText)
  }
  const { BillingUsageDetails } = await import(pathToFileURL(join(scratch, 'details.mjs')))
  const { visitWallTime, usageDate } = await import(pathToFileURL(join(scratch, 'usage-format.mjs')))
  const data = {
    state: 'ready',
    period: { id: 'period', starts_at: '2026-09-01T12:00:00Z', ends_at: '2026-10-01T12:00:00Z',
      agency_timezone: 'America/St_Johns', plan_code: 'standard', plan_version: 1, base_interval: 'year',
      included_clients: 10, additional_client_amount_cents: 500, currency: 'cad', finalization_eligible_at: '2026-10-04T12:00:00Z' },
    usage: { is_estimate: true, calculated_at: '2026-09-20T12:00:00Z', active_client_count: 30,
      additional_clients: 20, estimated_usage_amount_cents: 10000,
      clients: Array.from({ length: 30 }, (_, index) => ({ client_id: `client-${index}`, client_name: `Client ${String(index).padStart(2, '0')}`,
        client_archived: index === 0, local_start: '2026-09-15T09:30:00', completion_status: index === 0 ? 'no_show' : 'scheduled',
        shift_id: `shift-${index}`, occurrence_date: '2026-09-15', modification_id: null })) },
  }
  const html = renderToStaticMarkup(createElement(BillingUsageDetails, { data }))
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
  assert.match(text, /Estimated additional-client charge: CAD 100\.00/)
  assert.match(text, /20 additional clients × CAD 5\.00/)
  assert.match(text, /base subscription is billed annually/)
  assert.match(text, /excludes your base subscription, taxes and adjustments/)
  assert.match(text, /Archived/)
  assert.match(text, /No-show/)
  assert.match(text, /Page 1 of 2/)
  assert.equal((html.match(/<tr /g) ?? []).length, 25)
  assert.match(usageDate('2026-09-01T12:00:00Z', 'America/St_Johns'), /9:30:00/)
  const before = process.env.TZ
  try {
    process.env.TZ = 'America/Los_Angeles'
    assert.match(visitWallTime('2026-03-08T02:30:00'), /2:30:00/) // Browser-zone DST must not change the agency's wall time.
    process.env.TZ = 'Asia/Tokyo'
    assert.match(visitWallTime('2026-03-08T02:30:00'), /2:30:00/)
  } finally {
    if (before === undefined) delete process.env.TZ
    else process.env.TZ = before
  }
  const empty = structuredClone(data)
  empty.usage = { ...empty.usage, active_client_count: 0, additional_clients: 0, estimated_usage_amount_cents: 0, clients: [] }
  assert.match(renderToStaticMarkup(createElement(BillingUsageDetails, { data: empty })), /No clients have a qualifying visit/)
  const archived = structuredClone(data)
  archived.usage.clients = [{ ...archived.usage.clients[0], client_name: '<script>alert(1)</script>' }]
  assert.doesNotMatch(renderToStaticMarkup(createElement(BillingUsageDetails, { data: archived })), /<script>/)
  console.log('Billing usage rendering checks passed: annual amounts, evidence, pagination, empty state, escaping, agency timezone and DST.')
} finally {
  // Delete only the freshly-created test directory inside this project's cache.
  if (!resolve(scratch).startsWith(`${resolve(cache)}${sep}billing-usage-`)) throw new Error('Unexpected test output path')
  rmSync(scratch, { recursive: true, force: true })
}
