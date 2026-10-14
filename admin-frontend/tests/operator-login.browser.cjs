const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')
async function run() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  try {
    for (const mode of ['operator', 'agency', 'failure']) {
      const page = await browser.newPage()
      const errors = []
      page.on('pageerror', e => errors.push(e.message))
      await page.goto('http://127.0.0.1:5201/tests/operator-login.html')
      await page.getByPlaceholder('jane@sunrisehomecare.com').waitFor()
      await page.evaluate(mode => { window.operatorFixture.mode = mode }, mode)
      await page.getByPlaceholder('jane@sunrisehomecare.com').fill('fixture@example.invalid')
      await page.locator('input[type=password]').fill('fictional-password')
      await page.getByRole('button', { name: 'Sign In', exact: true }).click()
      if (mode === 'failure') {
        await page.getByRole('alert').waitFor()
        assert.equal(await page.getByText(/workspace reached|dashboard reached/).count(), 0)
        await page.evaluate(() => { window.operatorFixture.mode = 'operator' })
        await page.getByRole('button', { name: 'Try again' }).click()
      }
      await page.getByRole('heading', { name: mode === 'agency' ? 'Agency dashboard reached' : 'Operator workspace reached' }).waitFor()
      assert.deepEqual([...new Set(await page.evaluate(() => window.operatorFixture.calls))], ['/api/billing/operator/access'])
      assert.deepEqual(errors, [])
      await page.close()
    }
    console.log('PASS: operator landing, agency landing, failed access check and retry; server response overrides agency role metadata')
  } finally { await browser.close() }
}
run().catch(error => { console.error(error); process.exitCode = 1 })
