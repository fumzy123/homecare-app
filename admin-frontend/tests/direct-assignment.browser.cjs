// Launched by the PostgreSQL integration test; all coverage writes hit real routes.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')
const f = JSON.parse(require('node:fs').readFileSync(process.argv[2], 'utf8'))
const base = process.env.CARE_REQUEST_TEST_URL
async function run() {
  const browser = await chromium.launch({
    channel: process.env.BROWSER_CHANNEL || 'msedge',
    headless: true,
  })
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1100 },
    })
    const user = {
      id: f.user_id,
      email: 'admin@example.invalid',
      email_confirmed_at: '2026-01-01',
      user_metadata: {
        first_name: 'Admin',
        last_name: 'Test',
        role: 'owner',
        org_id: f.org_id,
      },
      app_metadata: {},
      aud: 'authenticated',
    }
    await context.addInitScript(
      ({ user, host }) => {
        const payload = btoa(
          JSON.stringify({
            sub: user.id,
            exp: 2100000000,
            aud: 'authenticated',
          }),
        )
        localStorage.setItem(
          `sb-${host.split('.')[0]}-auth-token`,
          JSON.stringify({
            access_token: `e30.${payload}.test`,
            refresh_token: 'fixture',
            expires_at: 2100000000,
            expires_in: 3600,
            token_type: 'bearer',
            user,
          }),
        )
      },
      { user, host: new URL(base).hostname },
    )
    await context.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, (r) =>
      r.abort(),
    )
    await context.route('**/auth/v1/**', (r) => r.fulfill({ json: user }))
    const unexpected = [],
      errors = [],
      approvals = []
    await context.route('**/api/**', async (r) => {
      const url = new URL(r.request().url()),
        p = url.pathname
      if (
        p.startsWith('/api/placements') ||
        p === '/api/assignments' ||
        p === '/api/org-members' ||
        p.endsWith('/care-need')
      ) {
        if (p.endsWith('/approve')) approvals.push(r.request().postDataJSON())
        return r.fulfill({
          response: await r.fetch({ url: `${f.api}${p}${url.search}` }),
        })
      }
      let data
      if (p === '/api/billing/status')
        data = {
          has_access: true,
          subscription_status: 'active',
          new_billing_flow: true,
          billing_timezone: 'America/St_Johns',
        }
      else if (p === '/api/notifications')
        data = { notifications: [], unread_count: 0, action_needed_count: 0 }
      else if (p === '/api/attention-items')
        data = { items: [], checked_at: new Date().toISOString() }
      else if (p === `/api/clients/${f.client_id}`) data = f.client
      else {
        unexpected.push(p)
        data = []
      }
      await r.fulfill({ json: data })
    })
    const page = await context.newPage()
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(
      f.entry === 'client'
        ? `${base}/dashboard/clients/${f.client_id}/care-need`
        : `${base}/dashboard/placements/${f.request_id}`,
    )
    if (f.entry === 'client')
      await page
        .getByRole('link', { name: 'View posted care request', exact: true })
        .click()
    await page.waitForURL(`**/dashboard/placements/${f.request_id}`)
    const workspaceUrl = page.url()
    const slots = () => page.getByRole('combobox', { name: /^Worker for/ })
    const review = () =>
      page.getByRole('button', { name: 'Review approval', exact: true })
    const approve = () =>
      page.getByRole('button', { name: 'Approve and schedule', exact: true })
    const arranged = () =>
      page.getByRole('checkbox', { name: /I have arranged this coverage/ })
    const gaps = () =>
      page.getByRole('checkbox', {
        name: /I understand these Care Slots remain uncovered/,
      })
    await slots().first().waitFor()
    assert.equal(await page.getByRole('searchbox', { name: 'Search workers' }).count(), 0)
    assert.equal(await page.getByRole('checkbox', { name: 'Show interested workers only' }).count(), 0)
    await slots().first().locator('optgroup[label="Other active workers"]').waitFor({ state: 'attached' })
    assert.equal(await slots().first().locator('optgroup[label="Interested in this slot"]').count(), 0)
    await slots().first().selectOption(f.workers[2])
    await page.getByRole('button', { name: 'Interested workers · 0', exact: true }).click()
    await page.getByText('No worker interest yet.', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Care coverage', exact: true }).click()
    assert.equal(await slots().first().inputValue(), f.workers[2], 'Direct selection survives switching tabs')
    await review().click()
    await approve().waitFor()
    assert.equal(
      await approve().isDisabled(),
      true,
      'Hours limit must block direct assignment',
    )
    await page
      .getByText('Resolve the reported issues before approving this coverage.')
      .waitFor()
    assert.equal(approvals.length, 0)
    await page.getByRole('button', { name: 'Back to coverage' }).click()
    await slots().first().selectOption(f.workers[0])
    await slots().nth(1).selectOption(f.workers[0])
    await review().click()
    await arranged().waitFor()
    assert.equal(await approve().isDisabled(), true)
    await gaps().check()
    assert.equal(
      await approve().isDisabled(),
      true,
      'Phone arrangement must be confirmed',
    )
    await arranged().check()
    await page.getByText(/already scheduled \+/).waitFor()
    assert.equal(await approve().isEnabled(), true)
    await approve().click()
    await page
      .getByText('Coverage approved and visits scheduled.', { exact: true })
      .waitFor()
    assert.equal(page.url(), workspaceUrl)
    assert.equal(approvals[0].confirm_admin_arranged, true)
    assert.equal(approvals[0].selections.length, 2)
    assert(
      approvals[0].selections.every(
        (s) => s.assignment_source === 'admin_arranged',
      ),
    )
    assert.equal(await slots().count(), 1)
    await slots().first().selectOption(f.workers[1])
    await review().click()
    await arranged().waitFor()
    assert.equal(
      await arranged().isChecked(),
      false,
      'A new approval needs a new confirmation',
    )
    assert.equal(await gaps().count(), 0)
    await arranged().check()
    await approve().click()
    await page.getByText('Coverage complete.', { exact: true }).waitFor()
    assert.equal(page.url(), workspaceUrl)
    // A reload reads persisted coverage and provenance through the actual API.
    await page.reload()
    await page.getByText('Coverage complete.', { exact: true }).waitFor()
    assert.equal(
      await page.getByText('· Arranged by admin', { exact: true }).count(),
      3,
    )
    assert.equal(await slots().count(), 0)
    assert.deepEqual(unexpected, [])
    assert.deepEqual(errors, [])
    console.log(`Real direct-assignment browser workflow passed (${f.entry}).`)
  } finally {
    await browser.close()
  }
}
run().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
