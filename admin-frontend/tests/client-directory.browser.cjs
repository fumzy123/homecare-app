// Real app route, isolated fictional auth/API. Optional snapshot from local demo data.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const base = process.env.CLIENT_DIRECTORY_TEST_URL || 'http://127.0.0.1:5196'
const output = process.env.CLIENT_DIRECTORY_SCREENSHOT_DIR || os.tmpdir()
const user = { id: '00000000-0000-4000-8000-000000000001', email: 'owner@example.test', email_confirmed_at: '2026-01-01', aud: 'authenticated', app_metadata: {}, user_metadata: { first_name: 'Test', last_name: 'Owner', role: 'owner', org_id: '00000000-0000-4000-8000-000000000002' } }
const summary = { weekly_hours: 6, slot_count: 3, covered_slot_count: 3, state: 'scheduled', starts_on: '2026-10-27', revision_pending: false, scheduled_change_on: null }
const clients = process.env.CLIENT_DIRECTORY_DATA
  ? JSON.parse(fs.readFileSync(process.env.CLIENT_DIRECTORY_DATA, 'utf8'))
  : [['Eleanor', 'Bennett'], ['Arthur', 'Collins'], ['Margaret', 'Sullivan'], ['George', 'Mercer']].map(([first_name, last_name], i) => ({
    id: `client-${i}`, first_name, last_name, date_of_birth: '1944-01-01', city: "St. John's", street: `${101 + i} Demo Lane`, status: 'active',
    directory_care: { ...summary, weekly_hours: i === 1 ? 9 : 6, covered_slot_count: [3, 2, 3, 0][i], revision_pending: i === 0, starts_on: i === 2 ? '2026-11-02' : '2026-10-27', state: i === 3 ? 'requested' : 'scheduled' },
  }))
async function run() {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true })
  try {
    const context = await browser.newContext({ viewport: { width: 1700, height: 1000 } })
    const page = await context.newPage(), errors = [], unexpected = []
    page.on('pageerror', e => errors.push(e.message))
    await context.addInitScript(({ user, host }) => {
      localStorage.setItem(`sb-${host.split('.')[0]}-auth-token`, JSON.stringify({ user, access_token: `e30.${btoa(JSON.stringify({ sub: user.id, exp: 2100000000, aud: 'authenticated' }))}.test`, refresh_token: 'fixture', expires_at: 2100000000, expires_in: 3600, token_type: 'bearer' }))
    }, { user, host: new URL(base).hostname })
    await context.route('**/auth/v1/**', r => r.fulfill({ json: user }))
    await context.route('**/api/**', async r => {
      const p = new URL(r.request().url()).pathname
      let data
      if (p === '/api/clients') data = clients
      else if (p === '/api/billing/status') data = { has_access: true, subscription_status: 'active', new_billing_flow: true, billing_timezone: 'America/St_Johns' }
      else if (p === '/api/attention-items') data = { org_id: user.user_metadata.org_id, checked_at: new Date().toISOString(), items: [], unread_count: 0 }
      else if (p === '/api/notifications') data = { notifications: [], unread_count: 0 }
      else { unexpected.push(p); data = [] }
      await r.fulfill({ json: data })
    })
    await page.goto(`${base}/dashboard/clients`)
    const directory = page.locator('.client-workspace.cw-page')
    await directory.getByRole('row').filter({ hasText: 'Eleanor' }).waitFor()
    assert.equal(await directory.getByRole('row').count(), 5)
    assert.equal(await directory.getByText('3/3 covered', { exact: true }).count(), 2)
    await directory.getByText('1 slot open', { exact: true }).waitFor()
    await directory.getByText('Unassigned', { exact: true }).waitFor()
    await directory.getByText('Revision pending', { exact: true }).waitFor()
    assert.equal(await directory.getByText('101 Demo Lane', { exact: true }).count(), 1)
    assert.equal(await directory.getByText(/Not active yet|years/).count(), 0)
    await page.evaluate(() => document.fonts.ready)
    fs.mkdirSync(output, { recursive: true })
    await directory.screenshot({ path: path.join(output, 'client-directory-desktop.png') })
    await directory.getByRole('textbox', { name: 'Search clients' }).fill('Arthur')
    assert.equal(await directory.getByRole('row').count(), 2)
    await directory.getByRole('textbox', { name: 'Search clients' }).fill('')
    await directory.getByRole('button', { name: 'On hold', exact: true }).click()
    await directory.getByRole('heading', { name: 'No clients found' }).waitFor()
    await directory.getByRole('button', { name: 'All', exact: true }).click()
    await page.setViewportSize({ width: 390, height: 844 })
    await directory.getByRole('row').filter({ hasText: 'George' }).waitFor()
    const sizing = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth, table: document.querySelector('.cw-table-scroll').scrollWidth }))
    assert(sizing.scroll <= sizing.width + 1, 'The page must not overflow; only the table scrolls')
    await page.screenshot({ path: path.join(output, 'client-directory-mobile.png'), fullPage: true })
    assert.deepEqual(errors, [])
    assert.deepEqual(unexpected, [])
    console.log('PASS: real client directory, coverage states, addresses, search, status filters, responsive table and no unnecessary placement requests.')
    console.log(path.join(output, 'client-directory-desktop.png'))
  } finally { await browser.close() }
}
run().catch(e => { console.error(e); process.exitCode = 1 })
