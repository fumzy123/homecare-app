// Self-contained local browser check. Uses fictional contact/configuration only.
// PLAYWRIGHT_MODULE may point to a shared installation; BROWSER_CHANNEL defaults to msedge.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const { spawn } = require('node:child_process')
const { once } = require('node:events')
const { mkdir } = require('node:fs/promises')
const assert = require('node:assert/strict')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const port = Number(process.env.ACCOUNT_DELETION_TEST_PORT || 5202)
const base = `http://127.0.0.1:${port}`

async function scenario(browser, contact) {
  const server = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: root, windowsHide: true, stdio: 'pipe',
    env: { ...process.env, VITE_BACKEND_API_URL: base, VITE_SUPABASE_URL: base,
      VITE_SUPABASE_PUBLISHABLE_KEY: 'fictional-public-key', VITE_STRIPE_PUBLISHABLE_KEY: 'pk_test_fictional',
      VITE_SENTRY_DSN: '', VITE_PRIVACY_CONTACT_EMAIL: contact },
  })
  let startup = ''
  server.stdout.on('data', chunk => { startup += chunk.toString() })
  server.stderr.on('data', chunk => { startup += chunk.toString() })
  const context = await browser.newContext()
  try {
    for (let i = 0; ; i++) {
      assert(server.exitCode === null, `Local Vite failed: ${startup}`)
      if (startup.includes('Local:')) break
      assert(i < 150, 'Local Vite startup timed out')
      await new Promise(resolve => setTimeout(resolve, 200))
    }
    const external = []
    const apiCalls = []
    await context.route('**/*', route => {
      const url = new URL(route.request().url())
      // The existing app shell eagerly imports billing. Keep its SDK entirely
      // fictional without loading Stripe or exercising payment functionality.
      if (url.hostname === 'js.stripe.com') return route.fulfill({
        contentType: 'application/javascript', body: 'window.Stripe = function () { return {}; };',
      })
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' })
      if (url.origin !== base) { external.push(url.origin); return route.abort() }
      if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/v1/')) {
        apiCalls.push(url.pathname)
        return route.fulfill({ status: 401, contentType: 'application/json', body: '{}' })
      }
      return route.continue()
    })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(base + '/account-deletion')
    await page.getByRole('heading', { name: 'Request account deletion', exact: true }).waitFor()
    assert.equal(new URL(page.url()).pathname, '/account-deletion')
    assert(await page.getByText('Current and former workers can both make a request.', { exact: false }).isVisible())
    assert(await page.getByText('You do not need to resign to submit a request.', { exact: false }).isVisible())
    if (contact) {
      const href = await page.getByRole('link', { name: 'Write an email request' }).getAttribute('href')
      assert.equal(decodeURIComponent(new URL(href).pathname), contact)
      assert(await page.getByText(contact, { exact: true }).isVisible())
      assert(await page.getByText('Send the email to submit your request.', { exact: false }).isVisible())
    } else {
      assert.equal(await page.locator('a[href^="mailto:"]').count(), 0)
      assert(await page.getByRole('status').getByText('This request channel is not available.', { exact: false }).isVisible())
    }
    for (const width of [1280, 360]) {
      await page.setViewportSize({ width, height: 850 })
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Horizontal overflow')
    }
    await mkdir(path.join(root, '.cache'), { recursive: true })
    await page.screenshot({ path: path.join(root, '.cache', `account-deletion-${contact ? 'configured' : 'unconfigured'}.png`), fullPage: true })
    await page.getByRole('link', { name: 'Read the Privacy Policy' }).click()
    await page.getByRole('link', { name: 'Request account deletion', exact: true }).click()
    await page.getByRole('heading', { name: 'Request account deletion', exact: true }).waitFor()
    assert.deepEqual(errors, [])
    assert.deepEqual(external, [])
    assert.deepEqual(apiCalls, [], 'The request page must work without auth or agency API data')
    console.log(`PASS: signed-out page, ${contact ? 'configured email' : 'missing contact'}, narrow layout, privacy navigation, no account API calls`)
  } finally {
    await context.close()
    if (server.exitCode === null) {
      const stopped = once(server, 'exit')
      server.kill()
      await stopped
    }
  }
}

;(async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true })
  try {
    await scenario(browser, 'privacy@example.test')
    await scenario(browser, '')
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
