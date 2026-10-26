// Isolated browser walkthrough: all account and API data is fictional.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')
const path = require('node:path')
const os = require('node:os')
const base = process.env.TEAM_TEST_URL || 'http://127.0.0.1:5198'
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const user = { id: id(1), email: 'owner@example.test', email_confirmed_at: '2026-01-01', user_metadata: { first_name: 'Test', last_name: 'Owner', role: 'owner', org_id: id(2) }, app_metadata: {}, aud: 'authenticated' }
const owner = { id: id(1), first_name: 'Test', last_name: 'Owner', email: user.email, role: 'owner', is_active: true }
const supervisor = { id: id(3), first_name: 'Accepted', last_name: 'Supervisor', email: 'supervisor@example.test', role: 'supervisor', is_active: true, phone_number: '+17095551234', employment_type: 'full_time', hire_date: '2026-10-23' }
const invite = { id: id(4), email: supervisor.email, role: 'supervisor', expires_at: '2099-01-01' }
async function run() {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true, timeout: 30000 })
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    const page = await context.newPage(), errors = [], unexpected = []
    let accepted = false, unavailable = false, expired = true, revoked = false
    page.on('pageerror', error => errors.push(error.message))
    await context.addInitScript(({ user, host }) => {
      const payload = btoa(JSON.stringify({ sub: user.id, exp: 2100000000, aud: 'authenticated' }))
      localStorage.setItem(`sb-${host.split('.')[0]}-auth-token`, JSON.stringify({ access_token: `e30.${payload}.test`, refresh_token: 'fixture', expires_at: 2100000000, expires_in: 3600, token_type: 'bearer', user }))
    }, { user, host: new URL(base).hostname })
    await context.route('**/auth/v1/**', route => route.fulfill({ json: user }))
    await context.route('**/api/**', async route => {
      const url = new URL(route.request().url()), p = url.pathname, method = route.request().method()
      let data
      if (p === '/api/billing/status') data = { has_access: true, subscription_status: 'active', new_billing_flow: true, billing_timezone: 'America/St_Johns' }
      else if (p === '/api/attention-items') data = { org_id: id(2), checked_at: new Date().toISOString(), week_start: '2026-10-25', week_end: '2026-10-31', items: [], unread_count: 0 }
      else if (p === '/api/notifications') data = { notifications: [], unread_count: 0 }
      else if (p === '/api/org-members') {
        const role = url.searchParams.get('role')
        if (unavailable && role !== 'owner') return route.fulfill({ status: 503, json: { error: { message: 'Temporarily unavailable' } } })
        data = [owner, ...(accepted ? [supervisor, { ...supervisor, id: id(7), first_name: 'Inactive', last_name: 'Manager', role: 'manager', is_active: false }] : [])].filter(member => member.role === role)
      }
      else if (p === '/api/invitations') data = [...(!accepted ? [invite] : []), ...(!revoked ? [{ id: id(5), email: 'expired@example.test', role: 'nurse', expires_at: expired ? '2020-01-01' : '2099-01-01' }] : []), { id: id(6), email: 'worker@example.test', role: 'home_support_worker', expires_at: '2099-01-01' }]
      else if (p === `/api/invitations/${id(5)}/resend` && method === 'POST') { expired = false; data = { ok: true } }
      else if (p === `/api/invitations/${id(5)}` && method === 'DELETE') { revoked = true; data = { ok: true } }
      else { unexpected.push(`${method} ${p}`); data = [] }
      await route.fulfill({ json: data })
    })
    await page.goto(`${base}/settings/team`)
    await page.getByText('No staff members have joined yet.', { exact: false }).waitFor()
    assert.equal(await page.getByRole('tab', { name: /^Staff members/ }).getAttribute('aria-selected'), 'true')
    await page.getByRole('tab', { name: /^Pending invitations/ }).click()
    await page.getByRole('row').filter({ hasText: supervisor.email }).waitFor()
    assert.equal(await page.getByText('worker@example.test').count(), 0)
    await page.getByRole('button', { name: 'Resend invite to expired@example.test' }).click()
    await page.getByRole('row').filter({ hasText: 'expired@example.test' }).getByText('Pending', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Revoke invite to expired@example.test' }).click()
    await page.getByText('expired@example.test').waitFor({ state: 'hidden' })
    // Simulate invite acceptance elsewhere and a normal page visibility return.
    accepted = true
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); window.dispatchEvent(new Event('visibilitychange')); Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }); window.dispatchEvent(new Event('visibilitychange')) })
    await page.getByText('No pending invitations.', { exact: true }).waitFor()
    assert.equal(await page.getByRole('tab', { name: /^Pending invitations/ }).getAttribute('aria-selected'), 'true')
    await page.getByRole('tab', { name: /^Staff members/ }).click()
    assert.equal(await page.getByRole('rowheader', { name: 'Accepted Supervisor', exact: true }).count(), 1)
    await page.getByRole('rowheader', { name: 'Test Owner', exact: true }).waitFor()
    await page.getByRole('button', { name: 'View profile for Accepted Supervisor' }).click()
    await page.locator(`#team-profile-${supervisor.id}`).getByText('+17095551234', { exact: true }).waitFor()
    const desktop = path.join(os.tmpdir(), 'care-harbor-team-desktop.png')
    await page.screenshot({ path: desktop, fullPage: true })
    // Accessible keyboard navigation and a narrow viewport keep the content usable.
    await page.getByRole('tab', { name: /^Staff members/ }).focus()
    await page.keyboard.press('ArrowRight')
    assert.equal(await page.getByRole('tab', { name: /^Pending invitations/ }).getAttribute('aria-selected'), 'true')
    await page.keyboard.press('Home')
    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForFunction(() => document.querySelector('button[aria-label="Close menu"]').closest('aside').getBoundingClientRect().right <= 1)
    await page.getByRole('region', { name: 'Agency staff', exact: true }).scrollIntoViewIfNeeded()
    const mobile = path.join(os.tmpdir(), 'care-harbor-team-mobile.png')
    await page.screenshot({ path: mobile, fullPage: true })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Page must not overflow horizontally')
    // A refresh failure keeps the old members and displays an error, then Retry recovers.
    unavailable = true
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); window.dispatchEvent(new Event('visibilitychange')); Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }); window.dispatchEvent(new Event('visibilitychange')) })
    await page.getByRole('alert').filter({ hasText: "Couldn't refresh staff members" }).waitFor({ timeout: 20000 })
    await page.getByRole('rowheader', { name: 'Accepted Supervisor', exact: true }).waitFor()
    unavailable = false
    await page.getByRole('button', { name: 'Try again', exact: true }).click()
    await page.getByRole('alert').filter({ hasText: "Couldn't refresh staff members" }).waitFor({ state: 'hidden' })
    assert.deepEqual(errors, []); assert.deepEqual(unexpected, [])
    console.log('PASS: staff acceptance, owners, profiles, pending/expired invites, resend/revoke, focus refresh, keyboard tabs, responsive layout and error recovery')
    console.log(desktop); console.log(mobile)
  } finally { await browser.close() }
}
run().catch(error => { console.error(error); process.exitCode = 1 })
