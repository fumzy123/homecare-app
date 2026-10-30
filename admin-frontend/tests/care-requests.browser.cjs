// Run against local Vite configured with dummy public auth/API settings.
// Every API request is intercepted. No agency records are read or changed.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')
const path = require('node:path')
const base = process.env.CARE_REQUEST_TEST_URL || 'http://127.0.0.1:5198'
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const clientId = id(1),
  workerId = id(2),
  requestId = id(3),
  needId = id(4),
  orgId = id(5)
const user = {
  id: id(6),
  email: 'admin@example.test',
  email_confirmed_at: '2026-01-01',
  user_metadata: {
    first_name: 'Alex',
    last_name: 'Admin',
    role: 'owner',
    org_id: orgId,
  },
  app_metadata: {},
  aud: 'authenticated',
}
const client = {
  id: clientId,
  first_name: 'Robert',
  last_name: 'Ellis',
  street: '1 Example Street',
  city: 'St. John’s',
  province: 'NL',
  postal_code: 'A1A 1A1',
  status: 'active',
  date_of_birth: '1950-01-01',
}
const slots = [
  ['MO', '09:00', '10:30'],
  ['WE', '09:00', '13:00'],
  ['FR', '09:00', '12:00'],
].map(([day_of_week, start_time, end_time], i) => ({
  id: id(10 + i),
  day_of_week,
  start_time,
  end_time,
  worker_id: null,
  worker_name: null,
}))
const need = {
  id: needId,
  client_id: clientId,
  version: 4,
  imported: false,
  effective_from: '2026-10-01',
  care_slots: slots,
  created_at: '2026-09-28',
  scheduled_from: null,
  ends_on: null,
}
const makeRequest = () => ({
  id: requestId,
  org_id: orgId,
  client_id: clientId,
  client_first_name: 'Robert',
  client_last_name: 'Ellis',
  masked_location: 'St. John’s · East End',
  weekly_care_need_id: needId,
  status: 'open',
  care_slots: structuredClone(slots),
  covered_count: 0,
  start_date: '2026-10-01',
  created_at: '2026-09-28T12:00:00Z',
  requirements: 'First Aid required.\n\nAdditional notes:\nOne cat at home',
  interest_count: 1,
  interests: [
    {
      employment_id: workerId,
      first_name: 'Maya',
      last_name: 'Chen',
      care_slot_ids: slots.map((s) => s.id),
      note: 'Available for all requested times.',
    },
  ],
})

async function run() {
  const browser = await chromium.launch({
    channel: process.env.BROWSER_CHANNEL || 'msedge',
    headless: true,
  })
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1100 },
    })
    const page = await context.newPage(),
      errors = [],
      unexpected = [],
      posts = [],
      approvals = []
    let request = makeRequest(),
      blocked = false,
      stale = false,
      failClose = false,
      failList = false,
      emptyNeeds = false
    const later = {
      ...makeRequest(),
      id: id(30),
      client_id: id(31),
      weekly_care_need_id: id(32),
      client_first_name: 'Amelia',
      client_last_name: 'Clarke',
      start_date: '2026-10-10',
    }
    page.on('pageerror', (e) => errors.push(e.message))
    await context.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, (r) =>
      r.abort(),
    )
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
    await context.route('**/auth/v1/**', (r) => r.fulfill({ json: user }))
    await context.route('**/api/**', async (r) => {
      const url = new URL(r.request().url()),
        p = url.pathname,
        method = r.request().method()
      let data
      if (p === '/api/billing/status')
        data = {
          has_access: true,
          subscription_status: 'active',
          new_billing_flow: true,
          billing_timezone: 'America/St_Johns',
        }
      else if (p === '/api/attention-items')
        data = {
          org_id: orgId,
          checked_at: new Date().toISOString(),
          items:
            request.status === 'open'
              ? [
                  {
                    id: `care:${needId}`,
                    category: 'coverage',
                    stage: 'review_interest',
                    urgency: 'urgent',
                    subject: 'Robert Ellis',
                    detail: 'Care Slots need coverage',
                    due_on: '2026-10-01',
                    target: { kind: 'placement', record_id: requestId },
                  },
                ]
              : [],
          week_start: '2026-09-27',
          week_end: '2026-10-03',
        }
      else if (p === '/api/notifications')
        data = { notifications: [], unread_count: 0, action_needed_count: 0 }
      else if (p === '/api/org-members') data = [
        { id: id(70), first_name: 'Alex', last_name: 'Demo', employment_status: 'active', is_active: true },
        { id: workerId, first_name: 'Maya', last_name: 'Chen', employment_status: 'active', is_active: true },
      ]
      else if (p === '/api/clients') data = [client]
      else if (p === `/api/clients/${clientId}`) data = client
      else if (p === '/api/assignments') data = []
      else if (p.endsWith('/care-need')) data = emptyNeeds ? [] : [{ ...need, id: id(41), version: 5 }, need]
      else if (p === '/api/placements' && method === 'POST') {
        posts.push(r.request().postDataJSON())
        data = request
      } else if (p === '/api/placements') {
        if (failList)
          return r.fulfill({
            status: 503,
            json: { error: { message: 'Unavailable' } },
          })
        data = [later, request]
      } else if (p === `/api/placements/${requestId}`) data = request
      else if (p.endsWith('/approval-review')) {
        const body = r.request().postDataJSON()
        data = {
          review_token: 'reviewed-token',
          starts_on: body.starts_on,
          ends_previous_schedule: !request.scheduled_from,
          old_shifts: [
            {
              shift_id: id(90),
              worker_name: 'Daniel Brooks',
              description: 'Previous Monday coverage',
            },
          ],
          uncovered_slots: request.care_slots.filter(
            (s) =>
              !s.worker_id &&
              !body.selections.some((v) => v.care_slot_id === s.id),
          ),
          all_clear: !blocked,
          workers: [
            {
              worker_id: workerId,
              worker_name: 'Maya Chen',
              hours: { week_start: '2026-10-25', week_end: '2026-10-31', current: 0, proposed: 1.5, total: 1.5, max_weekly_hours: 40 },
              eligibility: {
                availability_ok: true,
                no_conflicts: !blocked,
                within_hours: true,
                all_clear: !blocked,
                reasons: blocked ? ['Already scheduled at this time.'] : [],
                check_details: { availability: [], conflicts: blocked ? ['First conflicting visit: Other client on 2026-10-28, 09:30–12:00. This overlaps the selected care.'] : [], hours: [] },
              },
            },
          ],
        }
      } else if (p.endsWith('/approve')) {
        const body = r.request().postDataJSON()
        approvals.push(body)
        if (stale)
          return r.fulfill({
            status: 409,
            json: { error: { message: 'This request changed. Review again.' } },
          })
        assert.equal(body.review_token, 'reviewed-token')
        for (const s of request.care_slots)
          if (body.selections.some((v) => v.care_slot_id === s.id)) {
            s.worker_id = workerId
            s.worker_name = 'Maya Chen'
          }
        request.covered_count = request.care_slots.filter(
          (s) => s.worker_id,
        ).length
        request.status =
          request.covered_count === request.care_slots.length
            ? 'filled'
            : 'open'
        request.scheduled_from = body.starts_on
        data = request
      } else if (p.endsWith('/close')) {
        if (failClose)
          return r.fulfill({
            status: 409,
            json: { error: { message: 'Request changed. Try again.' } },
          })
        request.status = 'closed'
        data = request
      } else {
        unexpected.push(`${method} ${p}`)
        data = []
      }
      await r.fulfill({ json: data })
    })
    const shot = async (name) => {
      if (process.env.CARE_REQUEST_SCREENSHOT_DIR)
        await page.screenshot({
          path: path.join(
            process.env.CARE_REQUEST_SCREENSHOT_DIR,
            `${name}.png`,
          ),
          fullPage: true,
          animations: 'disabled',
        })
    }
    const open = async () => {
      await page.goto(`${base}/dashboard/placements/${requestId}`, {
        waitUntil: 'domcontentloaded',
      })
      await page
        .getByRole('heading', { name: 'Robert Ellis', exact: true })
        .waitFor()
    }
    const select = () => page.getByRole('combobox', { name: /^Worker for/ })
    await page.goto(`${base}/dashboard/placements`, {
      waitUntil: 'domcontentloaded',
    })
    await page.getByRole('link', { name: 'View Robert Ellis' }).waitFor()
    assert.match(
      await page.locator('.cr-table tbody tr').first().innerText(),
      /Robert Ellis/,
    )
    await page
      .getByRole('columnheader', { name: 'Care request start date' })
      .waitFor()
    assert.equal(
      await page.locator('.cr-segments').first().locator('span').count(),
      3,
    )
    await shot('care-requests-directory')
    await page
      .getByRole('textbox', { name: 'Search care requests' })
      .fill('nobody')
    await page.getByText('No matching requests.', { exact: true }).waitFor()
    await page.getByRole('textbox', { name: 'Search care requests' }).fill('')
    const requestLink = page.getByRole('link', { name: 'View Robert Ellis' })
    await requestLink.focus()
    assert.equal(await requestLink.evaluate(el => el === document.activeElement), true)
    const row = requestLink.locator('xpath=ancestor::tr')
    assert.equal(await row.getByRole('link').count(), 1)
    const clientCell = await row.locator('td').first().boundingBox()
    assert(clientCell)
    // Hit the client-name area, outside the visible View link.
    await page.mouse.click(clientCell.x + 20, clientCell.y + clientCell.height / 2)

    await page.getByText('Care request / Revision 4', { exact: true }).waitFor()
    assert.equal(
      await page.getByRole('button', { name: 'Client overview' }).count(),
      0,
    )
    await page.getByText('Request details', { exact: true }).click()
    await page.getByText('First Aid required.', { exact: true }).waitFor()
    await shot('care-request-detail')
    // Interest is grouped per slot, ahead of alphabetically earlier direct candidates.
    assert.equal(await page.getByRole('searchbox', { name: 'Search workers' }).count(), 0)
    assert.equal(await page.getByRole('checkbox', { name: 'Show interested workers only' }).count(), 0)
    await select().first().locator('optgroup[label="Other active workers"]').waitFor({ state: 'attached' })
    assert.deepEqual(await select().first().locator('optgroup').evaluateAll((groups) => groups.map((g) => g.label)), ['Interested in this slot', 'Other active workers'])
    assert.equal(await select().first().locator('optgroup').first().locator('option').getAttribute('value'), workerId)
    // A direct choice survives tab changes and an interested-worker selection for other slots.
    await select().first().selectOption(id(70))
    await page.getByRole('button', { name: 'Interested workers · 1', exact: true }).click()
    await page.getByRole('button', { name: /Select for 2 Care Slots/ }).click()
    assert.deepEqual(await select().evaluateAll((inputs) => inputs.map((input) => input.value)), [id(70), workerId, workerId])
    await page.getByRole('button', { name: 'Interested workers · 1', exact: true }).click()
    await page.getByRole('button', { name: 'Care coverage', exact: true }).click()
    assert.deepEqual(await select().evaluateAll((inputs) => inputs.map((input) => input.value)), [id(70), workerId, workerId])
    await select().nth(1).selectOption('')
    await select().nth(2).selectOption('')
    // The explicit revision round trip retains draft coverage, targets the posted
    // revision even when a newer one exists, and never silently saves/approves.
    await page.getByLabel('Coverage starts', { exact: true }).fill('2026-11-02')
    await page.getByRole('link', { name: 'Open weekly care request', exact: true }).click()
    await page.getByRole('heading', { name: 'Revision 4', exact: true }).waitFor()
    assert.match(page.url(), /need=00000000-0000-4000-8000-000000000004/)
    await page.getByRole('link', { name: 'View posted care request', exact: true }).waitFor()
    await page.getByRole('button', { name: 'Create new revision', exact: true }).click()
    assert.equal(await page.getByRole('combobox', { name: 'Viewing revision', exact: true }).isDisabled(), true, 'Cannot switch revisions while editing')
    page.once('dialog', (dialog) => dialog.dismiss())
    await page.getByRole('navigation', { name: 'Breadcrumb', exact: true }).getByRole('link', { name: 'Clients', exact: true }).click()
    await page.getByRole('heading', { name: 'New revision', exact: true }).waitFor()
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    const revision = page.getByRole('combobox', { name: 'Viewing revision', exact: true })
    assert.equal(await revision.isEnabled(), true)
    await revision.selectOption(id(41))
    await page.getByRole('heading', { name: 'Revision 5', exact: true }).waitFor()
    await revision.selectOption(needId)
    await page.getByRole('link', { name: 'View posted care request', exact: true }).click()
    await select().first().waitFor()
    assert.equal(await select().first().inputValue(), id(70))
    assert.equal(await page.getByLabel('Coverage starts', { exact: true }).inputValue(), '2026-11-02')
    assert.equal(approvals.length, 0)
    // Return drafts are consumed: a confirmed unrelated departure discards edits.
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('link', { name: 'All care requests', exact: true }).click()
    await page.getByRole('link', { name: 'View Robert Ellis' }).click()
    await select().first().waitFor()
    assert.equal(await select().first().inputValue(), '')
    // Partial selection uses actual durations and requires the gap acknowledgment.
    await select().first().selectOption(workerId)
    await page.getByText('1.5h / week', { exact: true }).waitFor()
    await page.getByRole('button', { name: /^Open Action Tower/ }).click()
    page.once('dialog', (dialog) => dialog.dismiss())
    await page
      .getByRole('button', { name: 'Review interested workers', exact: true })
      .click()
    assert.equal(
      await select().first().inputValue(),
      workerId,
      'Cancelled tower navigation must preserve selections',
    )
    await page
      .getByRole('button', { name: 'Minimize Action Tower', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'Review approval', exact: true })
      .click()
    const confirm = () =>
      page.getByRole('button', { name: 'Approve and schedule', exact: true })
    await confirm().waitFor()
    await page.getByText('The selected care slots fit Maya Chen’s recorded availability.', { exact: true }).waitFor()
    await page.getByText('No overlapping visits were found in this worker’s schedule.', { exact: true }).waitFor()
    await page.getByText('The selected care keeps this worker within their maximum of 40 hours per week and passes the overtime check.', { exact: true }).waitFor()
    assert.equal(await page.getByText(/Reflects any previous coverage ending/).count(), 0)
    await page.getByText('View first-week hours', { exact: true }).click()
    await page.getByText(/Oct 25, 2026–Oct 31, 2026: the week containing/).waitFor()
    const reviewWeek = page.getByRole('region', { name: 'New recurring coverage by weekday', exact: true })
    assert.equal(await reviewWeek.locator('.cr-review-day').count(), 7)
    const monday = reviewWeek.getByRole('region', { name: 'Mon new coverage', exact: true })
    await monday.getByText('Maya Chen', { exact: true }).waitFor()
    await monday.getByText('09:00–10:30', { exact: true }).waitFor()
    await monday.getByText('1.5h', { exact: true }).waitFor()
    assert.equal(await reviewWeek.locator('.cr-review-care-slot').count(), 1)
    await shot('care-request-weekly-review')
    await page.setViewportSize({ width: 390, height: 844 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
    assert.equal(await reviewWeek.evaluate((el) => el.scrollWidth > el.clientWidth), true)
    await page.setViewportSize({ width: 1440, height: 1100 })
    assert.equal(await confirm().isDisabled(), true)
    await page.getByRole('checkbox').check()
    await confirm().click()
    await page.getByText('Partially covered', { exact: true }).waitFor()
    assert.equal(approvals[0].accept_uncovered, true)
    assert.equal(await select().count(), 2)
    // Interest selects only unapproved slots. Server conflicts stay blocking.
    await page
      .getByRole('button', { name: 'Interested workers · 1', exact: true })
      .click()
    await page.getByRole('button', { name: /Select for 2 Care Slots/ }).click()
    blocked = true
    await page
      .getByRole('button', { name: 'Review approval', exact: true })
      .click()
    await page
      .getByText('First conflicting visit: Other client on 2026-10-28, 09:30–12:00. This overlaps the selected care.', { exact: true })
      .waitFor()
    assert.equal(await confirm().isDisabled(), true)
    assert.equal(await page.getByRole('heading', { name: 'The previous schedule ends.', exact: true }).count(), 0)
    const failedCheck = page.locator('.cr-check-failed')
    assert.equal(await failedCheck.count(), 1)
    await failedCheck.getByText('Visit conflicts', { exact: false }).waitFor()
    await failedCheck.getByText('Needs attention', { exact: true }).waitFor()
    assert.equal(await page.locator('.cr-check-status').filter({ hasText: 'Passed' }).count(), 2)
    await shot('care-request-failed-check')
    await page.setViewportSize({ width: 390, height: 844 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
    await shot('care-request-failed-check-mobile')
    await page.setViewportSize({ width: 1440, height: 1100 })
    await page
      .getByRole('button', { name: 'Back to coverage', exact: true })
      .click()
    blocked = false
    stale = true
    await page
      .getByRole('button', { name: 'Review approval', exact: true })
      .click()
    await confirm().click()
    await page
      .getByRole('alert')
      .filter({ hasText: 'This request changed.' })
      .waitFor()
    stale = false
    await page
      .getByRole('button', { name: 'Review approval', exact: true })
      .click()
    await confirm().click()
    await page.getByText('Fully covered', { exact: true }).waitFor()
    assert.equal(
      await page
        .getByRole('button', { name: 'Close care request', exact: true })
        .count(),
      0,
    )
    assert.equal(request.covered_count, 3)
    // Closing preserves approved care, and a failed close leaves confirmation available.
    request.status = 'open'
    request.care_slots[2].worker_id = null
    request.covered_count = 2
    await open()
    await page
      .getByRole('button', { name: 'Close care request', exact: true })
      .click()
    await page.getByRole('button', { name: 'Keep open' }).click()
    assert.equal(request.status, 'open')
    await page
      .getByRole('button', { name: 'Close care request', exact: true })
      .click()
    failClose = true
    await page
      .getByRole('button', { name: 'Close request', exact: true })
      .click()
    await page
      .getByRole('alert')
      .filter({ hasText: 'Request changed. Try again.' })
      .waitFor()
    failClose = false
    await page
      .getByRole('button', { name: 'Close request', exact: true })
      .click()
    await page.getByText('Closed', { exact: true }).waitFor()
    assert.equal(request.covered_count, 2)
    // Posting reviews the selected saved revision and persists both note fields.
    await page
      .getByRole('link', { name: 'All care requests', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'Post care request', exact: true })
      .click()
    await page
      .getByRole('combobox', { name: 'Client', exact: true })
      .selectOption(clientId)
    await page
      .getByRole('textbox', { name: /Care & requirements/ })
      .fill('First Aid required')
    await page
      .getByRole('textbox', { name: /Additional notes/ })
      .fill('One cat at home')
    await page
      .getByRole('button', { name: 'Review posting', exact: true })
      .click()
    await page.getByRole('heading', { name: 'HSW needed.' }).waitFor()
    const dialog = page.getByRole('dialog', {
      name: 'Review care request',
      exact: true,
    })
    await dialog
      .getByRole('button', { name: 'Post care request', exact: true })
      .click()
    assert.equal(posts.length, 1)
    assert.equal(posts[0].weekly_care_need_id, id(41))
    assert.match(
      posts[0].requirements,
      /First Aid required\n\nAdditional notes:\nOne cat at home/,
    )
    // Empty care revision is an ordinary state, not a crash or an enabled post.
    emptyNeeds = true
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page
      .getByRole('button', { name: 'Post care request', exact: true })
      .click()
    await page
      .getByRole('combobox', { name: 'Client', exact: true })
      .selectOption(clientId)
    await page.getByRole('link', { name: 'Open weekly care request' }).waitFor()
    assert.equal(
      await page
        .getByRole('button', { name: 'Review posting', exact: true })
        .isDisabled(),
      true,
    )
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    emptyNeeds = false
    request = makeRequest()
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByRole('link', { name: 'View Robert Ellis' }).waitFor()
    await page.emulateMedia({ colorScheme: 'dark' })
    assert.equal(
      await page
        .locator('.cr-table td')
        .first()
        .evaluate((el) => getComputedStyle(el).color),
      'rgb(17, 17, 17)',
    )
    await page.setViewportSize({ width: 375, height: 950 })
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
    )
    await page.getByRole('link', { name: 'View Robert Ellis' }).click()
    await select().first().waitFor()
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
    )
    await shot('care-request-mobile')
    failList = true
    await page.goto(`${base}/dashboard/placements`, {
      waitUntil: 'domcontentloaded',
    })
    await page
      .getByRole('alert')
      .filter({ hasText: 'Could not load care requests.' })
      .waitFor({ timeout: 20000 })
    failList = false
    await page.getByRole('button', { name: 'Try again', exact: true }).click()
    await page.getByRole('link', { name: 'View Robert Ellis' }).waitFor()
    assert.deepEqual(unexpected, [])
    assert.deepEqual(errors, [])
    console.log(
      'Care Requests browser checks passed: priority, coverage, partial/full approval, conflicts, stale review, close failure/retry, posting, empty revision, responsive layout and request errors.',
    )
  } finally {
    await browser.close()
  }
}
run().catch((e) => {
  console.error(e)
  process.exit(1)
})
