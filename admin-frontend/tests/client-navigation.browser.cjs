// Real workspace components and router; fictional in-memory API, no agency records.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')
const base = process.env.CLIENT_NAVIGATION_TEST_URL || 'http://127.0.0.1:5201'

async function run() {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort())
    await page.goto(`${base}/tests/client-workspace.html?hold-navigation=1`)
    const header = page.locator('.cw-identity')
    const tabs = page.getByRole('navigation', { name: 'Client pages' })
    const editTitle = page.getByRole('heading', { name: 'The details that make care personal.' })
    await header.waitFor()
    const before = await header.boundingBox()
    await page.evaluate(() => { window.clientNavigationGate.hold = true })
    await page.getByRole('link', { name: 'Edit profile' }).click()
    await page.waitForFunction(() => window.clientNavigationGate.waiting)
    assert.equal(await header.isVisible(), true, 'Overview header must remain while edit navigation is pending')
    assert.equal(await tabs.isVisible(), true)
    assert.deepEqual(await header.boundingBox(), before, 'Overview must not jump before the edit page is ready')
    assert.equal(await editTitle.isVisible(), false)
    await page.evaluate(() => window.clientNavigationGate.release())
    await editTitle.waitFor()
    assert.equal(await header.count(), 0)
    assert.equal(await tabs.count(), 0)

    const editBefore = await editTitle.boundingBox()
    await page.evaluate(() => { window.clientNavigationGate.hold = true })
    await page.getByRole('link', { name: /← Margaret/ }).click()
    await page.waitForFunction(() => window.clientNavigationGate.waiting)
    assert.equal(await editTitle.isVisible(), true)
    assert.equal(await header.count(), 0, 'Overview header must not appear above the still-visible edit form')
    assert.deepEqual(await editTitle.boundingBox(), editBefore)
    await page.evaluate(() => window.clientNavigationGate.release())
    await header.waitFor()
    assert.equal(await tabs.isVisible(), true)
    assert.equal(await editTitle.count(), 0)
    assert.deepEqual(errors, [])
    console.log('Client navigation passed: layout stays stable during pending navigation in both directions.')
  } finally { await browser.close() }
}
run().catch(error => { console.error(error); process.exitCode = 1 })
