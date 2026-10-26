// Fictional records only; exercise the real New/Edit visit drawers and scope dialog.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')
const path = require('node:path'), os = require('node:os')
const base = process.env.VISIT_DRAWERS_TEST_URL || 'http://127.0.0.1:5198'
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const user = { id: id(1), email: 'owner@example.test', email_confirmed_at: '2026-01-01', user_metadata: { first_name: 'Test', last_name: 'Owner', role: 'owner', org_id: id(2) }, app_metadata: {}, aud: 'authenticated' }
const worker = { id: id(3), first_name: 'Sam', last_name: 'Demo', role: 'home_support_worker', employment_status: 'active' }
const client = { id: id(4), first_name: 'Test', last_name: 'Client', date_of_birth: '1950-01-01', status: 'active', street: '100 Demo Lane', city: 'St. John’s', province: 'NL', postal_code: 'A1A 1A1', care_team: [] }
const visit = { shift_id: id(5), date: '2026-10-28', start_time: '2026-10-28T13:00:00', end_time: '2026-10-28T15:00:00', completion_status: 'scheduled', worker, client, location: '100 Demo Lane', is_recurring: true, is_modification: true, recurrence_frequency: 'weekly', recurrence_days_of_week: ['WE'], notes: 'Original note' }
async function run() {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true, timeout: 30000 })
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }), page = await context.newPage()
    const writes = [], errors = [], unexpected = []
    let failCreate = true
    page.on('pageerror', error => errors.push(error.message))
    await context.addInitScript(({ user, host }) => {
      if (window.location.hostname !== host) return
      const payload = btoa(JSON.stringify({ sub: user.id, exp: 2100000000, aud: 'authenticated' }))
      localStorage.setItem(`sb-${host.split('.')[0]}-auth-token`, JSON.stringify({ access_token: `e30.${payload}.test`, refresh_token: 'fixture', expires_at: 2100000000, expires_in: 3600, token_type: 'bearer', user }))
    }, { user, host: new URL(base).hostname })
    await context.route('**/auth/v1/**', route => route.fulfill({ json: user }))
    await context.route('**/api/**', async route => {
      const url = new URL(route.request().url()), p = url.pathname, method = route.request().method()
      let data
      if (p === '/api/billing/status') data = { has_access: true, subscription_status: 'active', new_billing_flow: true, billing_timezone: 'America/St_Johns' }
      else if (p === '/api/attention-items') data = { org_id: id(2), items: [], unread_count: 0 }
      else if (p === '/api/notifications') data = { notifications: [], unread_count: 0 }
      else if (p === '/api/clients') data = [client]
      else if (p === '/api/org-members') data = [worker]
      else if (p === '/api/org-members/available') data = [worker.id]
      else if (p.endsWith('/availability') || p.endsWith('/care-need')) data = []
      else if (p.includes('/notes')) data = { entries: [] }
      else if (p === '/api/shifts' && method === 'POST') {
        if (failCreate) return route.fulfill({ status: 409, json: { error: { code: 'WORKER_ALREADY_SCHEDULED_AT_THIS_TIME_BLOCK', details: [{ date: '2026-10-28', start: '2026-10-28T09:00:00', end: '2026-10-28T17:00:00', client_name: 'Other Test Client' }] } } })
        writes.push(route.request().postDataJSON()); data = { id: id(9) }
      }
      else if (p === '/api/shifts') data = url.searchParams.get('completion_statuses') === 'dropped' ? [] : [visit]
      else { unexpected.push(`${method} ${p}`); data = [] }
      await route.fulfill({ json: data })
    })
    await page.goto(`${base}/dashboard/shifts?date=2026-10-28&shift=${visit.shift_id}&occurrence=2026-10-28`)
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    const edit = page.getByRole('dialog', { name: 'Edit shift', exact: true })
    await edit.getByRole('heading', { name: 'People & location', exact: true }).waitFor()
    assert.equal(Math.round((await edit.boundingBox()).width), 620)
    await edit.getByLabel('Notes', { exact: true }).fill('Keep my draft')
    page.once('dialog', dialog => dialog.dismiss())
    await edit.getByRole('button', { name: 'Close edit shift', exact: true }).click()
    assert.equal(await edit.getByLabel('Notes', { exact: true }).inputValue(), 'Keep my draft')
    await edit.getByRole('button', { name: 'Save Changes', exact: true }).click()
    const scope = page.getByRole('dialog', { name: 'Save changes', exact: true })
    await scope.getByRole('button', { name: /^This visit only/ }).waitFor()
    assert.equal(await scope.getByRole('button', { name: /^This visit only/ }).getAttribute('aria-pressed'), 'true')
    await scope.getByText('Selected visit: Wednesday, Oct 28, 2026', { exact: true }).waitFor()
    await scope.getByRole('button', { name: /^This and following visits/ }).click()
    assert.equal(await scope.getByRole('button', { name: /^This and following visits/ }).getAttribute('aria-pressed'), 'true')
    await scope.screenshot({ path: path.join(os.tmpdir(), 'care-harbor-visit-scope.png') })
    await page.keyboard.press('Escape')
    await scope.waitFor({ state: 'hidden' })
    assert.equal(await edit.getByLabel('Notes', { exact: true }).inputValue(), 'Keep my draft')
    // Returning from the nested dialog restores focus inside the editor.
    assert.ok(await edit.evaluate(el => el.contains(document.activeElement)))
    await edit.locator('.vd-body').evaluate(el => { el.scrollTop = 0 })
    await edit.screenshot({ path: path.join(os.tmpdir(), 'care-harbor-edit-visit.png') })
    await edit.getByRole('button', { name: 'Discard', exact: true }).click()
    await page.getByRole('button', { name: 'Cancel Shift', exact: true }).click()
    await page.getByRole('heading', { name: 'Cancel visit', exact: true }).waitFor()
    await page.getByRole('radio', { name: 'Just this occurrence', exact: true }).check()
    assert.equal(await page.getByRole('button', { name: 'Confirm Cancel', exact: true }).isEnabled(), false)
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await page.getByRole('button', { name: 'Close visit details', exact: true }).click()
    await page.getByRole('button', { name: /New shift/ }).click()
    const create = page.getByRole('dialog', { name: 'New shift', exact: true })
    await create.getByLabel('Worker', { exact: true }).selectOption(worker.id)
    await create.getByLabel('Client', { exact: true }).selectOption(client.id)
    await create.getByRole('button', { name: 'Visit date', exact: true }).click()
    await create.getByRole('button', { name: 'Today', exact: true }).click()
    await create.getByRole('button', { name: 'End time', exact: true }).click()
    await create.getByRole('button', { name: 'AM', exact: true }).click() // 05:00 AM rolls into tomorrow.
    await create.getByRole('heading', { name: 'Date & time', exact: true }).click()
    await create.getByRole('button', { name: 'End date', exact: true }).waitFor()
    await create.getByLabel('Notes', { exact: true }).fill('Overnight care notes')
    page.once('dialog', dialog => dialog.dismiss())
    await create.getByRole('button', { name: 'Close new shift', exact: true }).click()
    assert.equal(await create.getByLabel('Notes', { exact: true }).inputValue(), 'Overnight care notes')
    await create.getByRole('button', { name: 'Create Shift', exact: true }).click()
    const error = create.getByRole('alert').filter({ hasText: 'Other Test Client' })
    await error.waitFor()
    assert.ok(await error.evaluate(el => { const box = el.getBoundingClientRect(), body = el.closest('.vd-body').getBoundingClientRect(); return box.top >= body.top && box.bottom <= body.bottom + 1 }))
    assert.equal(writes.length, 0)
    await create.getByRole('switch', { name: 'Repeat this shift', exact: true }).click()
    await create.getByRole('button', { name: 'Wed', exact: true }).click()
    await create.locator('.vd-body').evaluate(el => { el.scrollTop = 0 })
    await create.screenshot({ path: path.join(os.tmpdir(), 'care-harbor-new-visit.png') })
    await page.setViewportSize({ width: 390, height: 844 })
    await create.screenshot({ path: path.join(os.tmpdir(), 'care-harbor-new-visit-mobile.png') })
    assert.ok(await create.evaluate(el => el.scrollWidth <= el.clientWidth + 1))
    const footer = await create.locator('.vd-footer').boundingBox()
    assert.ok(footer.y + footer.height <= 845, 'Save actions stay in the viewport')
    failCreate = false
    await create.getByRole('button', { name: 'Create Recurring', exact: true }).click()
    await create.waitFor({ state: 'hidden' })
    assert.equal(writes.length, 1)
    assert.deepEqual(writes[0].recurrence.days_of_week, ['WE'])
    assert.equal(writes[0].notes, 'Overnight care notes')
    assert.ok(new Date(writes[0].end_time) > new Date(writes[0].start_time), 'Overnight end stays after start')
    assert.deepEqual(errors, []); assert.deepEqual(unexpected, [])
    console.log('PASS: consistent drawers, draft protection, nested scope focus/Escape, conflict feedback, overnight recurrence payload, narrow layout and visible footer')
  } finally { await browser.close() }
}
run().catch(error => { console.error(error); process.exitCode = 1 })
