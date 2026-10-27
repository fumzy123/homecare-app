// Run against isolated Vite with dummy auth/API URLs matching SCHEDULE_TEST_URL.
// All requests use fictional fixtures; no agency data is read or written.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')
const base = process.env.SCHEDULE_TEST_URL || 'http://127.0.0.1:5201'
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const user = { id: id(1), email: 'schedule@example.test', email_confirmed_at: '2026-01-01', user_metadata: { first_name: 'Test', last_name: 'Admin', role: 'owner', org_id: id(2) }, app_metadata: {}, aud: 'authenticated' }
const workers = ['Alex', 'Casey', 'Jordan', 'Morgan'].map((name, i) => ({ id: id(i + 3), first_name: name, last_name: 'Demo', role: 'home_support_worker', employment_status: 'active' }))
const clients = ['Evelyn Long Client Name', 'Taylor'].map((name, i) => ({ id: id(i + 10), first_name: name, last_name: 'Demo', status: 'active', care_team: [] }))
const visit = (n, worker, client, start, end, status = 'scheduled', date = start.slice(0, 10)) => ({ shift_id: id(n), date, start_time: start, end_time: end, completion_status: status, worker, client, is_recurring: true, is_modification: date !== start.slice(0, 10), recurrence_frequency: 'weekly', recurrence_days_of_week: ['MO'], notes: 'Keep these instructions', location: '123 Demo Street' })
const visits = [
  visit(20, workers[0], clients[0], '2026-10-26T09:00:00', '2026-10-26T14:00:00'),
  visit(21, workers[1], clients[0], '2026-10-26T09:00:00', '2026-10-26T12:00:00'),
  visit(22, workers[2], clients[1], '2026-10-26T09:00:00', '2026-10-26T10:00:00'),
  visit(23, workers[0], clients[1], '2026-10-26T10:00:00', '2026-10-26T11:00:00'),
  visit(24, workers[0], clients[0], '2026-10-27T09:00:00', '2026-10-27T12:00:00', 'cancelled'),
  visit(25, workers[0], clients[0], '2026-10-28T09:00:00', '2026-10-28T12:00:00', 'dropped'),
  visit(26, workers[1], clients[1], '2026-10-29T22:00:00', '2026-10-30T02:00:00'),
  visit(27, workers[2], clients[0], '2026-10-30T15:00:00', '2026-10-30T17:00:00', 'scheduled', '2026-10-28'),
  visit(28, workers[0], clients[0], '2026-10-31T15:00:00', '2026-10-31T17:00:00', 'scheduled', '2026-11-02'),
]

async function run() {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true })
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } })
    const page = await context.newPage()
    const errors = [], unexpected = [], writes = [], ranges = []
    let fail = false
    page.on('pageerror', e => errors.push(e.message))
    await context.addInitScript(({ user, host }) => {
      const payload = btoa(JSON.stringify({ sub: user.id, exp: 2100000000, aud: 'authenticated' }))
      localStorage.setItem(`sb-${host.split('.')[0]}-auth-token`, JSON.stringify({ access_token: `e30.${payload}.test`, refresh_token: 'fixture', expires_at: 2100000000, expires_in: 3600, token_type: 'bearer', user }))
    }, { user, host: new URL(base).hostname })
    await context.route('**/auth/v1/**', route => route.fulfill({ json: user }))
    await context.route('**/api/**', async route => {
      const url = new URL(route.request().url()), p = url.pathname
      if (route.request().method() !== 'GET') writes.push(p)
      let data
      if (p === '/api/billing/status') data = { has_access: true, subscription_status: 'active', new_billing_flow: true, billing_timezone: 'America/St_Johns' }
      else if (p === '/api/attention-items') data = { items: [], unread_count: 0 }
      else if (p === '/api/clients') data = clients
      else if (p === '/api/org-members') data = workers
      else if (p === '/api/shifts') {
        if (fail) return route.fulfill({ status: 503, json: { error: { message: 'Fixture failure' } } })
        const from = url.searchParams.get('from_date'), to = url.searchParams.get('to_date')
        ranges.push([from, to])
        data = visits.filter(v => (url.searchParams.get('calendar_window') === 'true'
          ? v.start_time.slice(0, 10) <= to && v.end_time > `${from}T00:00:00`
          : v.date >= from && v.date <= to)
          && (!url.searchParams.get('worker_id') || v.worker.id === url.searchParams.get('worker_id'))
          && (!url.searchParams.get('client_id') || v.client.id === url.searchParams.get('client_id')))
      }
      else if (p.includes('/notes')) data = { entries: [] }
      else if (p === '/api/notifications') data = { notifications: [], unread_count: 0 }
      else { unexpected.push(p); data = [] }
      await route.fulfill({ json: data })
    })
    await page.goto(`${base}/dashboard/shifts?date=2026-10-28`)
    await page.locator('.schedule-calendar .rbc-event').first().waitFor()
    assert.ok(await page.locator('.rbc-time-gutter .rbc-label').count() > 0, 'Calendar retains time axis')
    const positions = await page.locator('.rbc-events-container').nth(1).locator('.rbc-event').evaluateAll(events => events.map(el => {
      const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }
    }))
    assert.equal(positions.length, 4)
    for (let i = 0; i < positions.length; i++) for (let j = i + 1; j < positions.length; j++) {
      const a = positions[i], b = positions[j]
      assert.ok(a.right <= b.left + 1 || b.right <= a.left + 1 || a.bottom <= b.top || b.bottom <= a.top, 'Calendar visits do not obscure one another')
    }
    if (process.env.SCHEDULE_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCHEDULE_SCREENSHOT_DIR}/calendar.png`, fullPage: true })
    const toggle = name => page.getByRole('group', { name: 'Schedule view', exact: true }).getByRole('button', { name, exact: true })
    await toggle('Workers').click()
    const table = page.getByRole('table', { name: 'Weekly worker schedule' })
    await table.waitFor()
    assert.equal(await table.locator('tbody tr').count(), 4)
    const alex = table.locator('tbody tr').filter({ has: page.getByRole('rowheader', { name: 'Alex Demo 8h scheduled', exact: true }) })
    assert.equal(await alex.locator('td').nth(1).getByRole('button').count(), 2, 'Overlapping visits remain individually selectable')
    assert.match(await table.locator('tbody').innerText(), /Morgan Demo\s+0h scheduled/)
    assert.equal(await table.getByRole('button', { name: /22:00.*02:00/ }).count(), 2, 'Overnight visit appears on both days')
    const moved = table.getByRole('button', { name: /Jordan Demo, Friday October 30, 15:00/ })
    await moved.focus(); await page.keyboard.press('Enter')
    await page.getByText('Visit details', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    assert.equal(await page.locator('textarea').inputValue(), 'Keep these instructions')
    await page.getByRole('button', { name: 'Discard', exact: true }).click()
    await page.keyboard.press('Escape')
    await table.waitFor()
    await page.locator('.schedule-scroll').evaluate(el => el.scrollTo({ left: 0 }))
    const left = await table.locator('tbody th').first().boundingBox()
    await page.locator('.schedule-scroll').evaluate(el => el.scrollBy({ left: 360, behavior: 'instant' }))
    assert.ok(await page.locator('.schedule-scroll').evaluate(el => el.scrollLeft) > 0)
    const scrolled = await table.locator('tbody th').first().boundingBox()
    assert.ok(Math.abs(left.x - scrolled.x) < 2, 'Worker names stay fixed')
    await page.locator('.schedule-scroll').evaluate(el => el.scrollTo({ left: 0, behavior: 'instant' }))
    if (process.env.SCHEDULE_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCHEDULE_SCREENSHOT_DIR}/workers.png`, fullPage: true })
    await page.getByLabel('Filter by worker').selectOption(workers[0].id)
    await page.getByLabel('Filter by client').selectOption(clients[0].id)
    await page.getByRole('rowheader', { name: 'Alex Demo 7h scheduled', exact: true }).waitFor()
    assert.equal(await table.locator('tbody tr').count(), 1)
    await toggle('Calendar').click()
    assert.equal(await page.getByLabel('Filter by worker').inputValue(), workers[0].id)
    assert.equal(await page.getByLabel('Filter by client').inputValue(), clients[0].id)
    await page.getByRole('button', { name: 'Month', exact: true }).click()
    await page.locator('.rbc-month-view').waitFor()
    await toggle('Workers').click()
    await table.getByText('Oct 25', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Next week', exact: true }).click()
    await table.getByText('Nov 1', { exact: true }).waitFor()
    await page.getByRole('rowheader', { name: 'Alex Demo 0h scheduled', exact: true }).waitFor()
    await toggle('Calendar').click()
    await page.locator('.rbc-month-view').waitFor()
    await page.getByText('November 2026', { exact: true }).waitFor()
    await toggle('Workers').click()
    await page.getByRole('button', { name: 'Previous week', exact: true }).click()
    await page.getByLabel('Filter by worker').selectOption('')
    await page.getByLabel('Filter by client').selectOption('')
    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForFunction(() => document.querySelector('aside').getBoundingClientRect().right <= 1)
    await table.waitFor()
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Narrow viewport has no page overflow')
    assert.ok(await page.locator('main').evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'Schedule stays inside the narrow main content area')
    await page.locator('.schedule-scroll').evaluate(el => el.scrollBy({ left: 360, behavior: 'instant' }))
    assert.equal(await page.locator('.schedule-toolbar').evaluate(el => el.parentElement.scrollTop), 0, 'Horizontal scrolling keeps date controls visible')
    if (process.env.SCHEDULE_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCHEDULE_SCREENSHOT_DIR}/workers-mobile.png`, fullPage: true })
    fail = true
    await page.getByRole('button', { name: 'Next week', exact: true }).click()
    await page.getByRole('alert').filter({ hasText: 'Could not load the schedule.' }).waitFor({ timeout: 20000 })
    assert.equal(await table.count(), 0, 'Failed fetch must not appear as an empty schedule')
    fail = false
    await page.getByRole('button', { name: 'Retry', exact: true }).click()
    await table.waitFor()
    assert.deepEqual(errors, [])
    assert.deepEqual(unexpected, [])
    assert.deepEqual(writes, [])
    assert.ok(ranges.some(([from, to]) => from === '2026-10-25' && to === '2026-10-31'))
    console.log('PASS: calendar time axis and concurrent labels; worker rows/hours/statuses/overnights; keyboard visit details; shared filters/dates/month; sticky names/scroll/narrow layout; failed load/retry; no writes')
  } finally { await browser.close() }
}
run().catch(error => { console.error(error); process.exitCode = 1 })
