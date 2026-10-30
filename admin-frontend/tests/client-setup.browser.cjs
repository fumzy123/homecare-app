// Actual admin routes/components with intercepted fictional API records.
// Verifies UX handoffs; backend scheduling rules have their own PostgreSQL suite.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')
const base = process.env.CARE_REQUEST_TEST_URL || 'http://127.0.0.1:5198'
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const day = new Date()
day.setUTCDate(day.getUTCDate() + 15)
while (day.getUTCDay() !== 6) day.setUTCDate(day.getUTCDate() + 1)
const starts = day.toISOString().slice(0, 10)
day.setUTCDate(day.getUTCDate() + 2)
const firstVisit = day.toISOString().slice(0, 10)
const stamp = new Date().toISOString()

async function journey(browser, returnToDirectory = false) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
  })
  const user = {
    id: id(1),
    email: 'admin@example.invalid',
    email_confirmed_at: stamp,
    aud: 'authenticated',
    user_metadata: {
      first_name: 'Admin',
      last_name: 'Test',
      role: 'owner',
      org_id: id(2),
    },
    app_metadata: {},
  }
  const worker = {
    id: id(3),
    first_name: 'Maya',
    last_name: 'Test',
    role: 'home_support_worker',
    is_active: true,
    employment_status: 'active',
  }
  let client,
    needs = [],
    request,
    visits = [],
    failClient = true
  const errors = [],
    unexpected = [],
    writes = [],
    visitQueries = []
  await context.addInitScript(
    ({ user, host }) => {
      localStorage.setItem(
        `sb-${host.split('.')[0]}-auth-token`,
        JSON.stringify({
          user,
          access_token: `e30.${btoa(JSON.stringify({ sub: user.id, exp: 2100000000, aud: 'authenticated' }))}.test`,
          refresh_token: 'fixture',
          expires_at: 2100000000,
          expires_in: 3600,
          token_type: 'bearer',
        }),
      )
    },
    { user, host: new URL(base).hostname },
  )
  await context.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, (r) =>
    r.abort(),
  )
  await context.route('**/auth/v1/**', (r) => r.fulfill({ json: user }))
  await context.route('**/api/**', async (r) => {
    const url = new URL(r.request().url()),
      p = url.pathname,
      method = r.request().method()
    const body = method === 'POST' ? r.request().postDataJSON() : null
    if (method === 'POST') writes.push({ p, body })
    let data
    if (p === '/api/billing/status')
      data = {
        has_access: true,
        subscription_status: 'active',
        new_billing_flow: true,
        billing_timezone: 'America/St_Johns',
      }
    else if (p === '/api/organization')
      data = { id: id(2), name: 'Test agency' }
    else if (p === '/api/attention-items')
      data = { items: [], checked_at: stamp }
    else if (p === '/api/notifications')
      data = { notifications: [], unread_count: 0, action_needed_count: 0 }
    else if (p === '/api/org-members') data = [worker]
    else if (p === '/api/clients' && body) {
      if (failClient) {
        failClient = false
        return r.fulfill({
          status: 503,
          json: { error: { message: 'Client save unavailable. Try again.' } },
        })
      }
      assert.equal(
        client,
        undefined,
        'Do not create a second client during continuation',
      )
      client = {
        ...body,
        id: id(10),
        created_at: stamp,
        updated_at: stamp,
        current_care_need: null,
      }
      data = client
    } else if (p === '/api/clients') data = client ? [client] : []
    else if (p === `/api/clients/${id(10)}`) data = client
    else if (p.endsWith('/care-need') && body) {
      assert.ok(body.care_slots.every(slot => !('service_type' in slot)))
      data = {
        ...body,
        id: id(40),
        client_id: client.id,
        version: 1,
        imported: false,
        created_at: stamp,
        activated_at: null,
        scheduled_from: null,
        ends_on: null,
        care_slots: body.care_slots.map((s, i) => ({ ...s, id: id(50 + i) })),
      }
      needs = [data]
    } else if (p.endsWith('/care-need')) data = needs
    else if (p === '/api/placements' && body) {
      request = {
        ...body,
        id: id(60),
        org_id: id(2),
        created_at: stamp,
        status: 'open',
        client_first_name: client.first_name,
        client_last_name: client.last_name,
        masked_location: client.city,
        interest_count: 0,
        interests: [],
        covered_count: 0,
        care_slots: needs[0].care_slots.map((s) => ({
          ...s,
          worker_id: null,
          worker_name: null,
        })),
      }
      data = request
    } else if (p === '/api/placements') data = request ? [request] : []
    else if (p === `/api/placements/${id(60)}`) data = request
    else if (p.endsWith('/approval-review'))
      data = {
        review_token: 'review',
        starts_on: body.starts_on,
        ends_previous_schedule: false,
        old_shifts: [],
        all_clear: true,
        uncovered_slots: request.care_slots.filter(
          (s) =>
            !s.worker_id &&
            !body.selections.some((v) => v.care_slot_id === s.id),
        ),
        workers: [
          {
            worker_id: worker.id,
            worker_name: 'Maya Test',
            eligibility: {
              all_clear: true,
              availability_ok: true,
              no_conflicts: true,
              within_hours: true,
              reasons: [],
            },
          },
        ],
      }
    else if (p.endsWith('/approve')) {
      assert.equal(body.confirm_admin_arranged, true)
      assert.equal(body.accept_uncovered, true)
      assert.equal(body.selections[0].assignment_source, 'admin_arranged')
      const slot = request.care_slots.find(
        (s) => s.id === body.selections[0].care_slot_id,
      )
      Object.assign(slot, {
        worker_id: worker.id,
        worker_name: 'Maya Test',
        assignment_source: 'admin_arranged',
      })
      request.covered_count = 1
      request.scheduled_from = body.starts_on
      Object.assign(needs[0], {
        activated_at: stamp,
        scheduled_from: body.starts_on,
      })
      visits = [
        {
          shift_id: id(70),
          date: firstVisit,
          start_time: `${firstVisit}T09:00:00`,
          end_time: `${firstVisit}T11:00:00`,
          completion_status: 'scheduled',
          worker,
          client,
          is_recurring: true,
        },
      ]
      data = request
    } else if (p === '/api/assignments')
      data = { today: stamp.slice(0, 10), assignments: [] }
    else if (p === '/api/shifts') {
      assert.equal(url.searchParams.get('client_id'), client.id)
      const from = url.searchParams.get('from_date'),
        to = url.searchParams.get('to_date')
      visitQueries.push({ from, to })
      data = visits.filter((v) => v.date >= from && v.date <= to)
    } else if (p.endsWith('/notes')) data = []
    else {
      unexpected.push(`${method} ${p}`)
      data = []
    }
    await r.fulfill({ json: data })
  })
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('dialog', (d) => {
    throw new Error(`Unexpected navigation/discard prompt: ${d.message()}`)
  })
  await page.goto(`${base}/dashboard/clients`)
  if (returnToDirectory)
    await page
      .getByRole('textbox', { name: 'Search clients' })
      .fill('another client')
  await page.getByRole('button', { name: 'New client', exact: true }).click()
  await page.getByLabel('First name *', { exact: true }).fill('Robin')
  await page.getByLabel('Last name *', { exact: true }).fill('Example')
  await page.getByLabel('Date of birth *', { exact: true }).fill('1940-01-01')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  for (const [name, value] of [
    ['Street address *', '1 Example Street'],
    ['City *', 'St. John’s'],
    ['Postal code *', 'a1a1a1'],
    ['Contact name *', 'Casey Example'],
    ['Relationship *', 'Family'],
    ['Contact phone *', '+17095550123'],
  ])
    await page.getByLabel(name, { exact: true }).fill(value)
  assert.equal(await page.getByLabel('Postal code *', { exact: true }).inputValue(), 'A1A 1A1')
  await page.getByRole('combobox', { name: /^Province/ }).selectOption('NL')
  // Shared phone entry: country-aware formatting, paste, caret editing and validation.
  const phone = page.getByRole('textbox', { name: 'Phone', exact: true })
  const country = page.getByRole('combobox', { name: 'Phone country', exact: true })
  assert.equal(await country.inputValue(), 'CA')
  await phone.pressSequentially('7095550123')
  assert.equal(await phone.inputValue(), '(709) 555-0123')
  await phone.evaluate(input => {
    const position = input.value.indexOf('555')
    input.setSelectionRange(position, position + 1)
  })
  await phone.press('6')
  assert.equal((await phone.inputValue()).replace(/\D/g, ''), '7096550123')
  await phone.press('Backspace')
  assert.equal((await phone.inputValue()).replace(/\D/g, ''), '709550123')
  await phone.fill('17095550123')
  assert.equal((await phone.inputValue()).replace(/\D/g, '').replace(/^1/, ''), '7095550123')
  await phone.fill('+44 20 7946 0018')
  assert.equal(await country.inputValue(), 'GB')
  assert.equal((await phone.inputValue()).replace(/\D/g, ''), '442079460018')
  await phone.fill('')
  await country.selectOption('US')
  await phone.pressSequentially('2025550123')
  assert.equal(await phone.inputValue(), '(202) 555-0123')
  await phone.fill('')
  await country.selectOption('CA')
  await phone.fill('123')
  await phone.press('Tab')
  assert.equal(await phone.getAttribute('aria-invalid'), 'true')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  assert.equal(await page.getByRole('textbox', { name: 'Care instructions', exact: true }).count(), 0)
  await phone.fill('')
  await phone.press('Tab')
  assert.equal(await phone.getAttribute('aria-invalid'), 'false')
  const emergencyPhone = page.getByRole('textbox', { name: 'Contact phone *', exact: true })
  await emergencyPhone.fill('')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByText('Phone number is required', { exact: true }).waitFor()
  await emergencyPhone.fill('7095550123')
  if (process.env.CLIENT_SETUP_SCREENSHOT_DIR && !returnToDirectory)
    await page.screenshot({ path: `${process.env.CLIENT_SETUP_SCREENSHOT_DIR}/phone-inputs.png` })
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  assert.equal(
    await page.getByRole('alert').count(),
    0,
    await page.getByRole('dialog').innerText(),
  )
  await page.getByRole('button', { name: 'About care instructions', exact: true }).focus()
  await page.getByRole('tooltip').filter({ hasText: 'Practical guidance shown to workers' }).waitFor()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'About agency notes', exact: true }).click()
  await page.getByRole('tooltip').filter({ hasText: 'Internal information for agency staff' }).waitFor()
  await page.getByRole('textbox', { name: 'Agency notes', exact: true }).fill('Internal test note')
  await page
    .getByRole('textbox', { name: 'Care instructions', exact: true })
    .fill('Retain these instructions')
  await page.getByRole('button', { name: 'Create client', exact: true }).click()
  await page
    .getByRole('alert')
    .filter({ hasText: 'Client save unavailable' })
    .waitFor()
  assert.equal(
    await page
      .getByRole('textbox', { name: 'Care instructions', exact: true })
      .inputValue(),
    'Retain these instructions',
  )
  await page.getByRole('button', { name: 'Create client', exact: true }).click()
  await page.getByRole('dialog', { name: 'Client created' }).waitFor()
  assert.equal(client.postal_code, 'A1A 1A1')
  assert.equal(client.notes, 'Internal test note')
  assert.equal(client.phone_number, null)
  assert.equal(client.emergency_contact_phone, '+17095550123')
  if (process.env.CLIENT_SETUP_SCREENSHOT_DIR)
    await page.screenshot({
      path: `${process.env.CLIENT_SETUP_SCREENSHOT_DIR}/client-created.png`,
    })
  assert.equal(
    await page
      .getByRole('button', { name: 'Create client', exact: true })
      .count(),
    0,
  )
  assert.equal(
    await page.getByRole('button', { name: 'Back to clients' }).isVisible(),
    true,
  )
  if (returnToDirectory) {
    await page.getByRole('button', { name: 'Back to clients' }).click()
    assert.equal(new URL(page.url()).pathname, '/dashboard/clients')
    assert.equal(
      await page.getByRole('textbox', { name: 'Search clients' }).inputValue(),
      'another client',
    )
    assert.equal(await page.getByRole('dialog').count(), 0)
    assert.equal('care_arrangement' in client, false)
    assert.deepEqual(errors, [])
    assert.deepEqual(unexpected, [])
    await context.close()
    console.log(
      'Client setup passed: save and return preserves directory filters.',
    )
    return
  }
  await page.getByRole('link', { name: 'Continue setting up care' }).click()
  await page.waitForURL(
    `**/${client.id}/care-need`,
  )
  assert.equal(await page.getByRole('link', { name: 'Funding', exact: true }).count(), 0)
  assert.equal(await page.getByRole('combobox', { name: 'Viewing revision', exact: true }).count(), 0, 'No revision selector before the first save')
  await page.getByRole('button', { name: 'Create weekly care request' }).click()
  await page.getByLabel('Revision starts').fill(starts)
  const board = page.getByRole('region', { name: 'Editable weekly care request' })
  const editSlot = (day, times = '09:00–11:00') => page.getByRole('button', { name: `Edit ${day} care slot ${times}`, exact: true })
  await page.getByRole('button', { name: 'Add care slot on Mon', exact: true }).click()
  assert.equal(await page.getByRole('combobox', { name: 'Service', exact: true }).count(), 0)
  let slotDialog = page.getByRole('dialog', { name: 'Add care slot', exact: true })
  await slotDialog.getByLabel('Start time', { exact: true }).fill('09:00')
  await slotDialog.getByLabel('End time', { exact: true }).fill('08:00')
  await slotDialog.getByRole('button', { name: 'Add slot', exact: true }).click()
  await slotDialog.getByRole('alert').filter({ hasText: 'end time after its start time' }).waitFor()
  await slotDialog.getByLabel('End time', { exact: true }).fill('11:00')
  await slotDialog.getByRole('checkbox', { name: 'Wed', exact: true }).check()
  await slotDialog.getByRole('button', { name: 'Add slot', exact: true }).click()
  await editSlot('Mon').waitFor()
  await editSlot('Wed').waitFor()
  assert.equal(await board.getByRole('button', { name: /^Edit / }).count(), 2)
  assert.equal(visits.length, 0)
  // Dragging into an overlapping time must keep the original draft intact.
  await editSlot('Wed').dragTo(page.getByRole('region', { name: 'Mon care slots', exact: true }))
  await page.getByRole('alert').filter({ hasText: 'cannot overlap' }).waitFor()
  await editSlot('Wed').waitFor()
  assert.equal(await board.getByRole('button', { name: /^Edit / }).count(), 2)
  // Drag into an empty day, then move back using only the edit form controls.
  await editSlot('Wed').dragTo(page.getByRole('region', { name: 'Thu care slots', exact: true }))
  await editSlot('Thu').waitFor()
  assert.equal(await editSlot('Wed').count(), 0)
  await editSlot('Thu').focus()
  await page.keyboard.press('Enter')
  slotDialog = page.getByRole('dialog', { name: 'Edit care slot', exact: true })
  await slotDialog.getByLabel('Day', { exact: true }).selectOption('WE')
  await slotDialog.getByRole('button', { name: 'Update slot', exact: true }).click()
  await editSlot('Wed').waitFor()
  // Editing one of the formerly grouped days must not edit the other.
  await editSlot('Mon').click()
  await slotDialog.getByLabel('End time', { exact: true }).fill('12:00')
  await slotDialog.getByRole('button', { name: 'Update slot', exact: true }).click()
  await editSlot('Mon', '09:00–12:00').waitFor()
  await editSlot('Wed').waitFor()
  await editSlot('Mon', '09:00–12:00').click()
  await slotDialog.getByLabel('End time', { exact: true }).fill('11:00')
  await slotDialog.getByRole('button', { name: 'Update slot', exact: true }).click()
  // Overlap rejection also applies to adding/copying; an adjacent slot is valid.
  await page.getByRole('button', { name: 'Add care slot on Mon', exact: true }).click()
  slotDialog = page.getByRole('dialog', { name: 'Add care slot', exact: true })
  await slotDialog.getByRole('button', { name: 'Add slot', exact: true }).click()
  await slotDialog.getByRole('alert').filter({ hasText: 'cannot overlap' }).waitFor()
  await slotDialog.getByLabel('Start time', { exact: true }).fill('11:00')
  await slotDialog.getByLabel('End time', { exact: true }).fill('12:00')
  await slotDialog.getByRole('button', { name: 'Add slot', exact: true }).click()
  await editSlot('Mon', '11:00–12:00').click()
  slotDialog = page.getByRole('dialog', { name: 'Edit care slot', exact: true })
  await slotDialog.getByRole('button', { name: 'Remove slot', exact: true }).click()
  assert.equal(await board.getByRole('button', { name: /^Edit / }).count(), 2)
  // Cancelling a new slot adds nothing. The weekly board scrolls inside a small screen.
  await page.getByRole('button', { name: 'Add care slot on Fri', exact: true }).click()
  await page.keyboard.press('Escape')
  assert.equal(await board.getByRole('button', { name: /^Edit / }).count(), 2)
  await page.setViewportSize({ width: 390, height: 844 })
  assert(await board.evaluate(el => el.scrollWidth > el.clientWidth))
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
  await page.getByRole('button', { name: 'Add care slot on Sat', exact: true }).click()
  slotDialog = page.getByRole('dialog', { name: 'Add care slot', exact: true })
  const dialogBox = await slotDialog.boundingBox()
  assert(dialogBox.x >= 0 && dialogBox.x + dialogBox.width <= 390)
  await slotDialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.setViewportSize({ width: 1440, height: 1100 })
  await board.evaluate(el => { el.scrollLeft = 0 })
  if (process.env.CLIENT_SETUP_SCREENSHOT_DIR) {
    await board.scrollIntoViewIfNeeded()
    await page.screenshot({ path: `${process.env.CLIENT_SETUP_SCREENSHOT_DIR}/editable-weekly-care.png` })
    await editSlot('Mon').click()
    await page.screenshot({ path: `${process.env.CLIENT_SETUP_SCREENSHOT_DIR}/care-slot-editor.png` })
    await page.getByRole('dialog', { name: 'Edit care slot' }).getByRole('button', { name: 'Cancel', exact: true }).click()
  }
  // A failed revision save must retain all draft slots, including moved/copied ones.
  await page.route(`**/api/clients/${client.id}/care-need`, async route => {
    if (route.request().method() !== 'POST') return route.fallback()
    await route.fulfill({ status: 500, json: { error: { message: 'Test revision save failed' } } })
    await page.unroute(`**/api/clients/${client.id}/care-need`)
  }, { times: 1 })
  await page.getByRole('button', { name: 'Save revision', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: 'Test revision save failed' }).waitFor()
  await editSlot('Mon').waitFor()
  await editSlot('Wed').waitFor()
  assert.equal(needs.length, 0)
  await page.getByRole('button', { name: 'Save revision', exact: true }).click()
  await page.getByRole('button', { name: 'Create new revision', exact: true }).click()
  const revision = page.getByRole('combobox', { name: 'Viewing revision', exact: true })
  assert.equal(await revision.inputValue(), needs[0].id, 'Saved revision is selected')
  assert.equal(await revision.isDisabled(), true)
  await editSlot('Mon').dragTo(page.getByRole('region', { name: 'Tue care slots', exact: true }))
  await editSlot('Tue').waitFor()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  assert.equal(await revision.isEnabled(), true)
  assert.deepEqual(needs[0].care_slots.map(slot => slot.day_of_week).sort(), ['MO', 'WE'])
  assert.equal(visits.length, 0)
  await page
    .getByRole('button', { name: 'Post care request', exact: true })
    .click()
  assert.equal(visits.length, 0)
  await page
    .getByRole('button', { name: 'Review posting', exact: true })
    .click()
  await page
    .getByRole('dialog', { name: 'Review care request' })
    .getByRole('button', { name: 'Post care request', exact: true })
    .click()
  await page
    .getByRole('link', { name: 'View posted care request', exact: true })
    .click()
  assert.equal(visits.length, 0)
  await page
    .getByRole('combobox', { name: /^Worker for Mon/ })
    .selectOption(worker.id)
  await page
    .getByRole('button', { name: 'Review approval', exact: true })
    .click()
  await page
    .getByRole('checkbox', { name: /I have arranged this coverage/ })
    .check()
  await page
    .getByRole('checkbox', { name: /I understand these Care Slots/ })
    .check()
  await page
    .getByRole('button', { name: 'Approve and schedule', exact: true })
    .click()
  const link = page.getByRole('link', { name: 'View newly scheduled visits' })
  await link.waitFor()
  if (process.env.CLIENT_SETUP_SCREENSHOT_DIR)
    await page.screenshot({
      path: `${process.env.CLIENT_SETUP_SCREENSHOT_DIR}/coverage-next-step.png`,
    })
  assert.equal(
    new URL(await link.getAttribute('href'), base).searchParams.get('week'),
    firstVisit,
  )
  await link.click()
  await page.waitForURL(`**/${client.id}/visits?week=${firstVisit}`)
  await page
    .getByRole('button', { name: /09:00.*Maya Test/ })
    .waitFor()
  assert(
    visitQueries.at(-1).from <= firstVisit &&
      visitQueries.at(-1).to >= firstVisit,
  )
  assert.equal(await page.getByRole('button', { name: 'Week', exact: true }).getAttribute('aria-pressed'), 'true')
  await page.getByRole('button', { name: 'List', exact: true }).click()
  assert.equal(await page.getByRole('button', { name: 'List', exact: true }).getAttribute('aria-pressed'), 'true')
  await page.getByRole('button', { name: 'Week', exact: true }).click()
  assert(visitQueries.at(-1).from <= firstVisit && visitQueries.at(-1).to >= firstVisit)
  await page.getByRole('button', { name: 'This week' }).click()
  await page.getByText('No visits', { exact: true }).first().waitFor()
  assert.equal(await page.getByText('No visits', { exact: true }).count(), 7)
  assert(visitQueries.at(-1).to < firstVisit)
  assert.equal(
    writes.filter((w) => w.p === '/api/clients').length,
    2,
    'Only the failed save and successful retry create a client',
  )
  assert.deepEqual(errors, [])
  assert.deepEqual(unexpected, [])
  console.log(
    `Client setup passed: intake, care revisions, posting, partial direct assignment and the first scheduled week.`,
  )
  await context.close()
}
async function run() {
  const browser = await chromium.launch({
    channel: process.env.BROWSER_CHANNEL || 'msedge',
    headless: true,
  })
  try {
    await journey(browser)
    await journey(browser, true)
  } finally {
    await browser.close()
  }
}
run().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
