// Actual intake/edit forms with fictional, intercepted API data.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')
const path = require('node:path')
const os = require('node:os')
const base = process.env.ADDRESS_TEST_URL || 'http://127.0.0.1:5198'
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const user = { id: id(1), email: 'owner@example.test', email_confirmed_at: '2026-01-01', user_metadata: { role: 'owner', org_id: id(2) }, app_metadata: {}, aud: 'authenticated' }
const address = { label: '100 Demo Street, St. John’s, NL, A1A 1A1', street: '100 Demo Street', city: 'St. John’s', province: 'NL', postal_code: 'A1A1A1' }
async function run() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } })
    const page = await context.newPage(), errors = [], unexpected = [], lookups = []
    let client, unavailable = false, saved
    page.on('pageerror', error => errors.push(error.message))
    await context.addInitScript(({ user, base }) => {
      if (location.origin !== base) return
      const payload = btoa(JSON.stringify({ sub: user.id, exp: 2100000000, aud: 'authenticated' }))
      localStorage.setItem(`sb-${location.hostname.split('.')[0]}-auth-token`, JSON.stringify({ access_token: `e30.${payload}.test`, refresh_token: 'fixture', expires_at: 2100000000, expires_in: 3600, token_type: 'bearer', user }))
    }, { user, base })
    await context.route('**/auth/v1/**', r => r.fulfill({ json: user }))
    await context.route('**/api/**', async r => {
      const p = new URL(r.request().url()).pathname, method = r.request().method()
      let data
      if (p === '/api/billing/status') data = { has_access: true, subscription_status: 'active', new_billing_flow: true, billing_timezone: 'America/St_Johns' }
      else if (p === '/api/attention-items') data = { items: [], checked_at: new Date().toISOString() }
      else if (p === '/api/notifications') data = { notifications: [], unread_count: 0 }
      else if (p === '/api/organization') data = { id: id(2), name: 'Test agency' }
      else if (p === '/api/addresses/autocomplete') {
        lookups.push(r.request().postDataJSON())
        if (unavailable) return r.fulfill({ status: 503, json: { error: { message: 'Unavailable' } } })
        data = { suggestions: [address] }
      }
      else if (p === '/api/clients' && method === 'POST') {
        saved = r.request().postDataJSON()
        client = { ...saved, id: id(10), created_at: new Date().toISOString(), current_care_need: null }
        data = client
      }
      else if (p === '/api/clients') data = client ? [client] : []
      else if (p === `/api/clients/${id(10)}`) data = client
      else if (p === '/api/org-members' || p.includes('/care-need') || p.includes('/notes') || p === '/api/shifts' || p === '/api/assignments' || p === '/api/placements') data = []
      else { unexpected.push(`${method} ${p}`); data = [] }
      await r.fulfill({ json: data })
    })
    await page.goto(`${base}/dashboard/clients`)
    const nativeDialogs = []
    page.on('dialog', async dialog => { nativeDialogs.push(dialog.message()); await dialog.dismiss() })
    const openClient = () => page.getByRole('button', { name: 'New client', exact: true }).click()
    const drawer = page.getByRole('dialog', { name: 'New client', exact: true })
    const confirmation = page.getByRole('dialog', { name: 'Discard changes?', exact: true })
    await openClient()
    await drawer.getByRole('button', { name: 'Close dialog', exact: true }).click()
    await drawer.waitFor({ state: 'hidden' })
    await openClient()
    await page.getByLabel('First name *', { exact: true }).fill('Temporary')
    await page.getByLabel('First name *', { exact: true }).fill('')
    await drawer.getByRole('button', { name: 'Cancel', exact: true }).click()
    await drawer.waitFor({ state: 'hidden' })
    await openClient()
    await page.getByLabel('First name *', { exact: true }).fill('Preserve me')
    await drawer.getByRole('button', { name: 'Close dialog', exact: true }).click()
    await confirmation.waitFor()
    assert.equal(await confirmation.getByRole('button', { name: 'Keep editing' }).evaluate(el => el === document.activeElement), true)
    await confirmation.getByRole('button', { name: 'Keep editing' }).click()
    await confirmation.waitFor({ state: 'hidden' })
    assert.equal(await page.getByLabel('First name *', { exact: true }).inputValue(), 'Preserve me')
    assert.equal(await drawer.getByRole('button', { name: 'Close dialog', exact: true }).evaluate(el => el === document.activeElement), true)
    await page.keyboard.press('Escape')
    await confirmation.waitFor()
    await page.keyboard.press('Escape')
    await confirmation.waitFor({ state: 'hidden' })
    await drawer.getByRole('button', { name: 'Cancel', exact: true }).click()
    await confirmation.getByRole('button', { name: 'Discard changes', exact: true }).click()
    await drawer.waitFor({ state: 'hidden' })
    assert.deepEqual(nativeDialogs, [])
    await page.getByRole('button', { name: 'New client', exact: true }).click()
    await page.getByLabel('First name *', { exact: true }).fill('Test')
    await page.getByLabel('Last name *', { exact: true }).fill('Address')
    await page.getByLabel('Date of birth *', { exact: true }).fill('1940-01-01')
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    const street = page.getByRole('combobox', { name: 'Street address *', exact: true })
    await street.pressSequentially('100 Demo', { delay: 30 })
    await page.getByRole('option', { name: address.label }).waitFor()
    assert.equal(lookups.length, 1)
    await page.screenshot({ path: path.join(os.tmpdir(), 'care-harbor-address-desktop.png') })
    await street.press('ArrowDown')
    await street.press('Enter')
    assert.equal(await street.inputValue(), address.street)
    assert.equal(await page.getByLabel('City *', { exact: true }).inputValue(), address.city)
    assert.equal(await page.getByRole('combobox', { name: /^Province/ }).inputValue(), 'NL')
    assert.equal(await page.getByLabel('Postal code *', { exact: true }).inputValue(), 'A1A 1A1')
    await street.fill('Unit 2, 100 Demo Street')
    await page.getByLabel('Contact name *', { exact: true }).fill('Demo Contact')
    await page.getByLabel('Relationship *', { exact: true }).fill('Family')
    await page.getByLabel('Contact phone *', { exact: true }).fill('7095550123')
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await page.getByRole('button', { name: 'Create client', exact: true }).click()
    await page.waitForFunction(() => document.body.textContent.includes('Client created'))
    assert.equal(saved.street, 'Unit 2, 100 Demo Street')
    assert.equal(saved.postal_code, 'A1A 1A1')
    // Editing an existing client never searches automatically or changes its saved address.
    await page.goto(`${base}/dashboard/clients/${id(10)}/edit`)
    await street.waitFor()
    const count = lookups.length
    await page.waitForTimeout(450)
    assert.equal(lookups.length, count)
    assert.equal(await street.inputValue(), saved.street)
    unavailable = true
    await street.fill('Manual address')
    await page.getByText('Suggestions are unavailable right now.', { exact: false }).waitFor()
    assert.equal(await street.inputValue(), 'Manual address')
    assert.equal(await page.getByLabel('City *', { exact: true }).inputValue(), address.city)
    unavailable = false
    await page.setViewportSize({ width: 390, height: 844 })
    await street.fill('100 Demo Street')
    await page.getByRole('option', { name: address.label }).waitFor()
    await street.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }))
    await page.waitForTimeout(300)
    await page.screenshot({ path: path.join(os.tmpdir(), 'care-harbor-address-mobile.png') })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    await page.getByRole('option', { name: address.label }).click()
    assert.equal(await street.inputValue(), address.street)
    assert.deepEqual(errors, [])
    assert.deepEqual(unexpected, [])
    console.log('PASS: intake and edit, debounce, keyboard/mouse selection, all four fields, manual unit, saved payload, unavailable lookup and mobile layout')
  } finally { await browser.close() }
}
run().catch(error => { console.error(error); process.exitCode = 1 })
