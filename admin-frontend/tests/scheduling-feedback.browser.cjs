// Fixture-only acceptance: no agency records are read or written.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')
const base = process.env.SCHEDULING_FEEDBACK_TEST_URL || 'http://127.0.0.1:5198'
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const user = { id: id(1), email: 'supervisor@example.test', email_confirmed_at: '2026-01-01', user_metadata: { first_name: 'Test', last_name: 'Supervisor', role: 'supervisor', org_id: id(2) }, app_metadata: {}, aud: 'authenticated' }
const worker = { id: id(3), first_name: 'Avery', last_name: 'Demo', role: 'home_support_worker', employment_status: 'active' }
const client = { id: id(4), first_name: 'Test', last_name: 'Client', date_of_birth: '1950-01-01', status: 'active', care_team: [] }
const occurrences = ['2026-10-28', '2026-11-04'].map(date => ({ shift_id: id(5), date, start_time: `${date}T13:00:00`, end_time: `${date}T15:00:00`, completion_status: 'scheduled', worker, client, is_recurring: true, is_modification: true, recurrence_frequency: 'weekly', recurrence_days_of_week: ['WE'], notes: 'Original note' }))
const decisions = ['approved', 'rejected'].map((status, index) => ({
  id: id(10 + index), event: id(20 + index), status, reason: index ? 'Use the existing visit instead.' : null,
}))

async function run() {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true })
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } })
    const page = await context.newPage()
    const seen = new Set(), writes = [], pageErrors = [], unexpected = []
    let failSave = false, failOpen = false
    page.on('pageerror', error => pageErrors.push(error.message))
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
      else if (p === '/api/attention-items') data = {
        org_id: id(2), checked_at: new Date().toISOString(), week_start: '2026-10-25', week_end: '2026-10-31',
        unread_count: decisions.filter(d => !seen.has(d.event)).length,
        items: decisions.filter(d => !seen.has(d.event)).map(d => ({ id: `notice:${d.id}`, category: 'schedule', stage: 'view_update', urgency: 'review', action_required: false,
          subject: `Overtime ${d.status} · Avery Demo`, detail: `Test Client · Requested visit: Oct 31, 2026 15:00–17:00. ${d.reason ? `Reason: ${d.reason}` : 'No decision reason was provided.'}`,
          target: { kind: 'overtime', record_id: d.id }, event_ids: [d.event], notification_ids: [d.id], unread_count: 1 })),
      }
      else if (p.startsWith('/api/shifts/overtime-requests/')) {
        if (failOpen) return route.fulfill({ status: 503, json: { error: { message: 'Unavailable' } } })
        const d = decisions.find(d => p.endsWith(d.id))
        data = { id: d.id, payload: { client_id: client.id, client_name: 'Test Client', start_time: '2026-10-31T15:00:00', end_time: '2026-10-31T17:00:00' },
          about_worker_first_name: 'Avery', about_worker_last_name: 'Demo', can_decide: false, resolved_at: '2026-10-23T12:00:00Z', request_status: d.status, decision_note: d.reason }
      }
      else if (p === '/api/activity/read') { route.request().postDataJSON().event_ids.forEach(event => seen.add(event)); data = { ok: true } }
      else if (p === '/api/clients') data = [client]
      else if (p === '/api/org-members') data = [worker]
      else if (p === '/api/shifts') data = url.searchParams.get('completion_statuses') === 'dropped' ? [] : occurrences
      else if (p === `/api/shifts/${id(5)}/modifications/2026-10-28` && method === 'PATCH') {
        if (failSave) return route.abort('failed')
        const body = route.request().postDataJSON(); writes.push(body); occurrences[0].notes = body.notes; data = occurrences[0]
      }
      else if (p.includes('/notes')) data = { entries: [] }
      else if (p === '/api/notifications') data = { notifications: [], unread_count: 0 }
      else { unexpected.push(`${method} ${p}`); data = [] }
      await route.fulfill({ json: data })
    })
    await page.goto(`${base}/dashboard`)
    const approved = page.locator('.tower-card').filter({ hasText: 'Overtime approved' })
    await approved.getByText('No decision reason was provided.', { exact: false }).waitFor()
    await approved.getByRole('button', { name: 'View request', exact: true }).click()
    const request = () => page.getByRole('dialog', { name: 'Overtime request', exact: true })
    await request().getByText('This request was approved.', { exact: true }).waitFor()
    await request().getByText('No decision reason was provided.', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Close overtime request' }).click()
    await approved.waitFor({ state: 'hidden' })
    assert.ok(seen.has(decisions[0].event))
    await page.goto(`${base}/dashboard/shifts?date=2026-10-28`)
    await page.getByRole('button', { name: /^Open Action Tower/ }).click()
    const rejected = page.locator('.tower-card').filter({ hasText: 'Overtime rejected' })
    await rejected.getByText('Use the existing visit instead.', { exact: false }).waitFor()
    failOpen = true
    await rejected.getByRole('button', { name: 'View request', exact: true }).click()
    await page.getByText('Could not open the request. Try again.').first().waitFor()
    assert.ok(!seen.has(decisions[1].event), 'Failed opening must preserve unread decision')
    failOpen = false
    await rejected.getByRole('button', { name: 'View request', exact: true }).click()
    await request().getByText('This request was rejected.', { exact: true }).waitFor()
    await request().getByText('Decision reason: Use the existing visit instead.', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Close overtime request' }).click()
    await page.getByRole('button', { name: /^Open Action Tower/ }).click()
    await rejected.waitFor({ state: 'hidden' })
    assert.ok(seen.has(decisions[1].event))
    assert.equal(writes.length, 0, 'Viewing decisions must not schedule visits')

    await page.goto(`${base}/dashboard/shifts?date=2026-10-28&shift=${id(5)}&occurrence=2026-10-28`)
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await page.locator('textarea').fill('Offline draft')
    await context.setOffline(true)
    await page.getByRole('button', { name: 'Save Changes', exact: true }).click()
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await page.getByRole('alert').filter({ hasText: "You're offline" }).waitFor()
    assert.equal(await page.locator('textarea').inputValue(), 'Offline draft')
    await context.setOffline(false)
    await page.waitForTimeout(300)
    assert.equal(writes.length, 0, 'Reconnection must not auto-save')
    await page.getByRole('button', { name: 'Retry save', exact: true }).click()
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await page.getByText('Visit details', { exact: true }).waitFor()
    assert.equal(writes.length, 1)
    assert.equal(occurrences[1].notes, 'Original note')

    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await page.locator('textarea').fill('Explicit retry draft')
    failSave = true
    await page.getByRole('button', { name: 'Save Changes', exact: true }).click()
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await page.getByRole('alert').filter({ hasText: "couldn't confirm the save" }).waitFor()
    assert.equal(await page.locator('textarea').inputValue(), 'Explicit retry draft')
    failSave = false
    await page.getByRole('button', { name: 'Retry save', exact: true }).click()
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await page.getByText('Visit details', { exact: true }).waitFor()
    assert.equal(writes.length, 2)
    assert.equal(occurrences[0].notes, 'Explicit retry draft')
    assert.equal(occurrences[1].notes, 'Original note')
    assert.deepEqual(pageErrors, [])
    assert.deepEqual(unexpected, [])
    console.log('PASS: overtime outcomes, reasons and request links in dashboard/floating Tower; unread recovery; offline/no automatic save; failed request retry and occurrence preservation')
  } finally { await browser.close() }
}
run().catch(error => { console.error(error); process.exitCode = 1 })
