/* Fixture-only browser checks. Run against Vite with dummy public env values.
 * PLAYWRIGHT_MODULE may point to a shared Playwright installation.
 * ATTENTION_SCREENSHOT_DIR optionally saves review screenshots.
 */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')
const path = require('node:path')
const base = process.env.ATTENTION_TEST_URL || 'http://127.0.0.1:5197'
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const clientId = id(1), workerId = id(2), placementId = id(3), needId = id(4), slotId = id(5), orgId = id(6), authId = id(7)
const user = { id: id(9), email: 'admin@example.test', email_confirmed_at: '2026-01-01', user_metadata: { first_name: 'Alex', last_name: 'Admin', role: 'owner', org_id: orgId }, app_metadata: {}, aud: 'authenticated' }
const client = { id: clientId, org_id: orgId, first_name: 'Robert', last_name: 'Ellis', date_of_birth: '1940-01-01', status: 'active', care_arrangement: 'funded', care_team: [], service_types: [], street: '1 Example Street', city: 'St. John’s', province: 'NL', postal_code: 'A1A1A1', created_at: '2026-01-01', coverage: 'covered' }
const worker = { id: workerId, first_name: 'Maria', last_name: 'Chen', email: 'maria@example.test', is_active: true, employment_status: 'active', role: 'home_support_worker', created_at: '2026-01-01' }
const slot = { id: slotId, day_of_week: 'TH', start_time: '09:00', end_time: '10:00', service_type: 'personal_care', worker_id: null, worker_name: null }
const placement = { id: placementId, org_id: orgId, client_id: clientId, client_first_name: 'Robert', client_last_name: 'Ellis', masked_location: 'St. John’s', start_date: '2026-10-01', status: 'open', weekly_care_need_id: needId, covered_count: 0, care_slots: [slot], interests: [{ employment_id: workerId, first_name: 'Maria', last_name: 'Chen', care_slot_ids: [slotId], note: null }] }
const need = { id: needId, client_id: clientId, version: 2, effective_from: '2026-10-01', created_at: '2026-09-28', imported: false, care_slots: [slot], ends_on: null }
const authorization = { id: authId, client_id: clientId, authorization_number: 'AUTH-2026-0482', funder: 'Sample funder', covering_start: '2026-01-01', covering_end: '2026-10-10', status: 'active', hours_period: 'bi_weekly', services: [{ id: id(10), service_type: 'personal_care', authorized_hours: 32 }] }
const credential = { id: id(11), document_type: 'first_aid_cpr', expiry_date: '2027-10-01', file_url: 'sample.pdf', uploaded_at: '2026-09-30', verified_at: null }
function action(n, category, stage, kind, record, detail, extra = {}) {
  return { id: n, category, stage, urgency: 'review', subject: category === 'credentials' ? 'Maria Chen' : 'Robert Ellis', detail, due_on: null, target: { kind, record_id: record, detail_id: null, document_type: null, occurrence_date: null }, ...extra }
}
const items = [
  action(`care:${needId}`, 'coverage', 'review_interest', 'placement', placementId, '1 interested worker · 1 open Care Slot', { urgency: 'urgent', due_on: '2026-10-01' }),
  action('credential:1', 'credentials', 'verify_credential', 'credential', workerId, 'First Aid / CPR', { target: { kind: 'credential', record_id: workerId, document_type: 'first_aid_cpr' } }),
  action('authorization:1', 'authorizations', 'renew_authorization', 'authorization', clientId, 'Sample funder · AUTH-2026-0482', { target: { kind: 'authorization', record_id: clientId, detail_id: authId } }),
  action('gap:1', 'schedule', 'review_schedule', 'weekly_schedule', clientId, 'Active client · No visits this week', { target: { kind: 'weekly_schedule', record_id: clientId, occurrence_date: '2026-09-27' } }),
]

async function run() {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true })
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    const page = await context.newPage()
    const errors = [], unexpected = []
    let feed = [...items], failFeed = false, checks = 0, writes = 0, visits = []
    page.on('pageerror', e => errors.push(e.message))
    page.on('console', msg => { if (msg.type() === 'error' && !msg.text().includes('503')) errors.push(msg.text()) })
    await context.addInitScript(({ user, host }) => {
      const payload = btoa(JSON.stringify({ sub: user.id, exp: 2100000000, aud: 'authenticated' }))
      localStorage.setItem(`sb-${host.split('.')[0]}-auth-token`, JSON.stringify({ access_token: `e30.${payload}.test`, refresh_token: 'fixture', expires_at: 2100000000, expires_in: 3600, token_type: 'bearer', user }))
    }, { user, host: new URL(base).hostname })
    await context.route('**/auth/v1/**', r => r.fulfill({ json: user }))
    await context.route('**/api/**', async r => {
      const url = new URL(r.request().url()), p = url.pathname, method = r.request().method()
      let data
      if (p === '/api/attention-items') { checks++; return r.fulfill({ status: failFeed ? 503 : 200, json: failFeed ? { error: { message: 'Unavailable' } } : { org_id: orgId, checked_at: new Date().toISOString(), week_start: '2026-09-27', week_end: '2026-10-03', items: feed } }) }
      if (p === '/api/billing/status') data = { has_access: true, subscription_status: 'active', new_billing_flow: true }
      else if (p === '/api/notifications') data = { notifications: [], unread_count: 0, action_needed_count: 0 }
      else if (p === '/api/clients') data = [client]
      else if (p === `/api/clients/${clientId}`) data = client
      else if (p === `/api/clients/${clientId}/care-need`) data = [need]
      else if (p === `/api/clients/${clientId}/authorizations`) data = [authorization]
      else if (p.includes('compliance')) data = { coverage: 'covered', services: [] }
      else if (p === '/api/org-members') data = [worker]
      else if (p === `/api/org-members/${workerId}`) data = worker
      else if (p.endsWith('/availability')) data = []
      else if (p === `/api/org-members/${workerId}/credentials`) data = [credential]
      else if (p.endsWith('/first_aid_cpr/verify')) { writes++; credential.verified_at = '2026-10-01'; feed = feed.filter(i => i.category !== 'credentials'); data = credential }
      else if (p === '/api/placements') data = [placement]
      else if (p === `/api/placements/${placementId}`) data = placement
      else if (p.endsWith('/approval-review')) data = { review_token: 'fixture-token', starts_on: '2026-10-01', ends_previous_schedule: false, old_shifts: [], uncovered_slots: [], all_clear: true, workers: [] }
      else if (p.endsWith('/approve')) { writes++; placement.covered_count = 1; placement.status = 'filled'; slot.worker_id = workerId; slot.worker_name = 'Maria Chen'; feed = feed.filter(i => i.id !== `care:${needId}`); data = placement }
      else if (p === '/api/shifts') data = visits
      else if (p.endsWith('/notes')) data = { entries: [] }
      else if (p.includes('/shifts') || p.includes('/notes')) data = []
      else { unexpected.push(`${method} ${p}`); data = [] }
      await r.fulfill({ json: data })
    })
    const waitText = text => page.getByText(text, { exact: true }).first().waitFor()
    const bubble = () => page.getByRole('button', { name: /^Open Action Tower/ })
    const panel = () => page.getByRole('dialog', { name: 'Action Tower', exact: true })
    const screenshot = async name => { if (process.env.ATTENTION_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.ATTENTION_SCREENSHOT_DIR, `${name}.png`), animations: 'disabled' }) }

    await page.goto(`${base}/dashboard`)
    await waitText('Care coverage is due.')
    assert.equal(await bubble().count(), 0, 'Dashboard should show the embedded tower only')
    await screenshot('action-tower-dashboard')
    await page.getByRole('button', { name: 'Review interested workers' }).click()
    await page.waitForURL(`**/placements/${placementId}`)
    await bubble().waitFor()
    await page.getByRole('combobox', { name: /^Worker for/ }).selectOption(workerId)
    await bubble().click()
    await screenshot('action-tower-open')
    page.once('dialog', dialog => dialog.dismiss())
    await panel().getByRole('button', { name: 'Review interested workers' }).click()
    assert.equal(await panel().isVisible(), true, 'Cancelled same-record navigation must keep the panel open')
    assert.equal(await page.getByRole('combobox', { name: /^Worker for/ }).inputValue(), workerId)
    await panel().getByRole('button', { name: /Worker credentials/ }).click()
    page.once('dialog', dialog => dialog.dismiss())
    await panel().getByRole('button', { name: 'Verify document' }).click()
    assert.ok(page.url().endsWith(placementId), 'Unsaved selection should block navigation')
    assert.equal(await panel().isVisible(), true, 'Cancelled navigation should keep the panel open')
    await page.getByRole('button', { name: 'Minimize Action Tower', exact: true }).click()
    await page.getByRole('button', { name: 'Review approval', exact: true }).click()
    const beforeSave = checks
    await page.getByRole('button', { name: 'Approve and schedule' }).click()
    await page.waitForFunction(() => document.body.innerText.toLowerCase().includes('fully covered'))
    await page.waitForTimeout(350)
    assert.ok(checks > beforeSave, 'Successful approval must refresh the feed')
    await bubble().click()
    assert.equal(await panel().getByText('Care coverage is due.').count(), 0)
    await panel().getByRole('button', { name: 'Verify document' }).click()
    await page.waitForURL(`**/workers/${workerId}/edit?document=first_aid_cpr`)
    await page.getByRole('button', { name: '✓ Verify', exact: true }).waitFor()
    assert.equal(await panel().count(), 0, 'Selecting an action should minimize the panel')
    await page.getByRole('button', { name: '✓ Verify', exact: true }).click()
    await page.waitForTimeout(350)
    await bubble().click()
    assert.equal(await panel().getByRole('button', { name: /Worker credentials/ }).count(), 0, 'Empty groups should disappear')
    await panel().getByRole('button', { name: /Expiring authorizations/ }).click()
    await panel().getByRole('button', { name: 'Review authorization' }).click()
    await page.waitForURL(`**/care-need?authorization=${authId}`)
    await page.getByText('Selected authorization: AUTH-2026-0482 · active').waitFor()
    await bubble().click()
    await screenshot('action-tower-floating')
    assert.ok(await panel().evaluate(el => parseFloat(getComputedStyle(el).borderRadius) > 0), 'Floating panel should have rounded outer corners')
    assert.equal(await page.getByRole('button', { name: 'Hide Action Tower button' }).count(), 0)
    await panel().getByRole('button', { name: 'Minimize Action Tower', exact: true }).click()
    assert.equal(await panel().count(), 0)
    assert.equal(await bubble().count(), 1, 'Minimizing keeps the circle available')
    await bubble().click()
    await panel().waitFor()
    await page.keyboard.press('Escape')
    assert.equal(await bubble().evaluate(el => el === document.activeElement), true)
    await bubble().click()
    await panel().getByRole('button', { name: /No visits this week/ }).click()
    await panel().getByRole('button', { name: 'Review weekly schedule' }).click()
    await page.waitForURL(`**/shifts?client=${clientId}&date=2026-09-27`)
    await page.getByRole('combobox', { name: 'Filter by client' }).waitFor()
    assert.equal(await page.getByRole('combobox', { name: 'Filter by client' }).inputValue(), clientId)
    await page.setViewportSize({ width: 390, height: 844 })
    await bubble().click()
    const bounds = await panel().boundingBox()
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 390 && bounds.y >= 0)
    await screenshot('action-tower-mobile')
    await page.getByRole('button', { name: 'Open menu', exact: true }).click()
    await panel().waitFor({ state: 'hidden' })
    assert.equal(await bubble().count(), 0, 'Mobile navigation should take precedence over the tower')
    await page.getByRole('button', { name: 'Close menu', exact: true }).click()
    await panel().waitFor()
    await page.setViewportSize({ width: 1440, height: 1000 })
    failFeed = true
    await page.reload()
    await bubble().click()
    await waitText('Could not refresh attention checks.')
    assert.equal(await panel().getByText('No outstanding items in these checks.').count(), 0)
    failFeed = false; feed = []
    await panel().getByRole('button', { name: 'Retry checks' }).click()
    await waitText('No outstanding items in these checks.')
    // A shifted occurrence keeps its original identity while the calendar opens
    // on its effective date. Closing and selecting it again must reopen it.
    const visitId = id(12)
    visits = [{ shift_id: visitId, date: '2026-08-01', start_time: '2026-10-01T09:00:00', end_time: '2026-10-01T10:00:00', completion_status: 'dropped', worker, client, is_recurring: false, is_modification: true, modification_id: id(13), notes: null }]
    feed = [action('visit:1', 'coverage', 'replace_worker', 'visit', visitId, 'Dropped visit · Replacement needed', { urgency: 'urgent', due_on: '2026-10-01', target: { kind: 'visit', record_id: visitId, occurrence_date: '2026-08-01' } })]
    await page.reload()
    await bubble().click()
    await page.getByRole('button', { name: 'Find replacement', exact: true }).click()
    await page.getByText('Shift Details', { exact: true }).waitFor()
    assert.ok(page.url().includes('occurrence=2026-08-01') && page.url().includes('date=2026-10-01'))
    assert.equal(await bubble().count(), 0, 'Visit drawer should take precedence over the tower')
    await page.getByRole('button', { name: '×', exact: true }).click()
    await bubble().click()
    await page.getByRole('button', { name: 'Find replacement', exact: true }).click()
    await page.getByText('Shift Details', { exact: true }).waitFor()
    await page.getByRole('button', { name: '×', exact: true }).click()
    // An unpublished care version opens that version in the existing history.
    feed = [action('care:unpublished', 'coverage', 'post_placement', 'care_need', clientId, 'Weekly Care Need ready to post', { target: { kind: 'care_need', record_id: clientId, detail_id: needId } })]
    await page.goto(`${base}/dashboard`)
    await page.reload()
    await page.getByRole('button', { name: /Care coverage/ }).click()
    await page.getByRole('button', { name: 'Post placement', exact: true }).click()
    await page.locator(`#care-need-${needId}`).waitFor()
    assert.equal(await page.locator(`#care-need-${needId}`).getAttribute('open'), '')
    assert.equal(writes, 2)
    assert.deepEqual(errors, [])
    assert.deepEqual(unexpected, [])
    console.log('PASS: dashboard, all six destination types, repeat selection, unsaved edits, approval/verification refresh, empty/error states, hide/restore, Escape focus, overlay priority and mobile bounds')
  } finally { await browser.close() }
}
run().catch(e => { console.error(e); process.exitCode = 1 })
