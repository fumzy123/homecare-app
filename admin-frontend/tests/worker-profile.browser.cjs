// Actual application routes with intercepted fictional auth/API only.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const base = process.env.WORKER_PROFILE_TEST_URL || 'http://127.0.0.1:5211'
const output = process.env.WORKER_PROFILE_SCREENSHOT_DIR
const user = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'owner@example.test',
  email_confirmed_at: '2026-01-01',
  aud: 'authenticated',
  app_metadata: {},
  user_metadata: {
    first_name: 'Alex',
    last_name: 'Demo',
    role: 'owner',
    org_id: '00000000-0000-4000-8000-000000000002',
  },
}
const worker = {
  id: 'worker-demo',
  first_name: 'Sarah',
  last_name: 'Reid',
  email: 'sarah@example.test',
  phone_number: '+17095550142',
  role: 'home_support_worker',
  is_active: true,
  employment_status: 'active',
  employment_type: 'full_time',
  max_hours_per_week: 40,
  has_vehicle: true,
  on_standby: false,
  next_shift_at: '2026-11-02T09:00:00',
  hire_date: '2024-03-11',
  gender: 'female',
  date_of_birth: '1992-08-08',
  street: '26 Demo Crescent',
  city: 'St. John’s',
  province: 'NL',
  postal_code: 'A1A 1A1',
  emergency_contact_name: 'Daniel Demo',
  emergency_contact_phone: '+17095550168',
  emergency_contact_relationship: 'Spouse',
}
const clients = [
  ['Margaret', 'Bennett'],
  ['Arthur', 'Collins'],
].map(([first_name, last_name], i) => ({
  id: `client-${i}`,
  first_name,
  last_name,
  status: 'active',
  street: '10 Demo Lane',
  city: 'St. John’s',
  province: 'NL',
  postal_code: 'A1A 1A1',
}))
let availability = ['MO', 'TU', 'WE', 'TH', 'FR'].map((day_of_week, i) => ({
  id: `availability-${i}`,
  day_of_week,
  start_time: '08:00:00',
  end_time: '17:00:00',
}))
let credentials = [
  'first_aid_cpr',
  'criminal_record_check',
  'vulnerable_sector_check',
  'drivers_license',
  'auto_insurance',
  'psw_certificate',
].map((document_type, i) => ({
  id: `credential-${i}`,
  org_member_id: worker.id,
  document_type,
  expiry_date: i ? '2028-04-12' : null,
  uploaded_at: '2026-10-30T12:00:00Z',
  verified_at: i ? '2026-10-30T13:00:00Z' : null,
  file_url: `private/${document_type}`,
}))
let leave = [
  {
    id: 'leave-1',
    worker_id: worker.id,
    leave_type: 'vacation',
    start_date: '2026-11-16',
    end_date: '2026-11-18',
    notes: null,
  },
]
const visits = [4, 6, 4, 6, 8].map((hours, i) => ({
  shift_id: `shift-${i}`,
  date: `2026-11-0${i + 2}`,
  start_time: `2026-11-0${i + 2}T09:00:00`,
  end_time: `2026-11-0${i + 2}T${String(9 + hours).padStart(2, '0')}:00:00`,
  completion_status: 'scheduled',
  is_modification: false,
  is_recurring: true,
  modification_id: null,
  worker,
  client: clients[i % 2],
  location: '10 Demo Lane',
  notes: 'Follow the care plan.',
  recurrence_end_date: null,
  recurrence_frequency: 'weekly',
  recurrence_days_of_week: [['MO'], ['TU'], ['WE'], ['TH'], ['FR']][i],
}))
const assignments = visits.map((v, i) => ({
  id: `assignment-${i}`,
  client_id: v.client.id,
  client_name: `${v.client.first_name} ${v.client.last_name}`,
  worker_id: worker.id,
  worker_name: 'Sarah Reid',
  placement_id: `placement-${i % 2}`,
  care_slot_id: `slot-${i}`,
  day_of_week: v.recurrence_days_of_week[0],
  start_time: v.start_time.slice(11),
  end_time: v.end_time.slice(11),
  starts_on: '2026-10-05',
  stops_from: null,
  revision_ends_on: null,
  end_reason: null,
  ended_at: null,
  status: 'active',
  can_end: true,
  assignment_source: 'worker_interest',
}))

async function run() {
  const browser = await chromium.launch({
    channel: process.env.BROWSER_CHANNEL || 'msedge',
    headless: true,
  })
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1100 },
      timezoneId: 'Australia/Sydney',
      locale: 'en-CA',
    })
    const page = await context.newPage(),
      errors = [],
      unexpected = [],
      writes = []
    page.setDefaultTimeout(12000)
    let verifyFails = true,
      availabilityFails = true,
      profileFails = true,
      leaveFails = true,
      readsFail = false
    page.on('pageerror', (e) => errors.push(e.message))
    await page.clock.setFixedTime(new Date('2026-11-02T11:00:00Z'))
    await context.addInitScript(
      ({ user, host }) =>
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
        ),
      { user, host: new URL(base).hostname },
    )
    await context.route('**/auth/v1/**', (r) => r.fulfill({ json: user }))
    await context.route('**/api/**', async (r) => {
      const url = new URL(r.request().url()),
        p = url.pathname,
        method = r.request().method()
      const body =
        ['POST', 'PATCH', 'PUT'].includes(method) && !p.endsWith('/upload')
          ? r.request().postDataJSON()
          : null
      if (method !== 'GET') writes.push({ p, method, body })
      const fail = (message) =>
        r.fulfill({
          status: 503,
          json: { error: { message, code: 'TEMPORARY_FAILURE' } },
        })
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
          org_id: user.user_metadata.org_id,
          checked_at: '2026-11-02T11:00:00Z',
          items: [],
          unread_count: 0,
        }
      else if (p === '/api/notifications')
        data = { notifications: [], unread_count: 0 }
      else if (p === '/api/org-members') data = [worker]
      else if (p === `/api/org-members/${worker.id}`) {
        if (method === 'PATCH') {
          if (profileFails) return fail('Profile save unavailable. Try again.')
          Object.assign(worker, body)
        }
        data = worker
      } else if (p === `/api/org-members/${worker.id}/availability`) {
        if (method === 'PUT') {
          if (availabilityFails)
            return fail('Availability save unavailable. Try again.')
          availability = body.entries.map((entry, i) => ({
            ...entry,
            id: `availability-${i}`,
          }))
        }
        data = availability
      } else if (p === '/api/org-members/available') data = [worker.id]
      else if (p === `/api/org-members/${worker.id}/credentials`) {
        if (readsFail) return fail('Documents unavailable.')
        data = credentials
      } else if (p.endsWith('/verify')) {
        if (verifyFails)
          return fail('Document verification unavailable. Try again.')
        const type = p.split('/').at(-2),
          c = credentials.find((c) => c.document_type === type)
        Object.assign(c, {
          expiry_date: body.expiry_date,
          verified_at: '2026-11-02T11:00:00Z',
        })
        data = c
      } else if (p.endsWith('/preview-url'))
        data = { url: `${base}/tests/worker-profile-preview-document` }
      else if (p.endsWith('/upload')) {
        const type = p.split('/').at(-2)
        const c = {
          id: `new-${type}`,
          document_type: type,
          file_url: `private/${type}`,
          expiry_date: null,
          uploaded_at: '2026-11-02T11:00:00Z',
          verified_at: null,
        }
        credentials = [
          ...credentials.filter((c) => c.document_type !== type),
          c,
        ]
        data = c
      } else if (p === `/api/org-members/${worker.id}/leave/review`) {
        data = { visits: [], protected_count: 0, review_token: 'leave-review' }
      } else if (p === `/api/org-members/${worker.id}/leave`) {
        if (method === 'POST') {
          if (leaveFails) return fail('Leave save unavailable. Try again.')
          const row = { ...body, id: 'leave-new', worker_id: worker.id }
          leave.push(row)
          data = row
        } else
          data = leave.filter((v) =>
            v.start_date.startsWith(url.searchParams.get('year')),
          )
      } else if (p.startsWith(`/api/org-members/${worker.id}/leave/`)) {
        leave = leave.filter((v) => v.id !== p.split('/').at(-1))
        data = null
      } else if (p === '/api/shifts') {
        assert.equal(url.searchParams.get('worker_id'), worker.id)
        assert.equal(url.searchParams.get('calendar_window'), 'true')
        const from = url.searchParams.get('from_date'),
          to = url.searchParams.get('to_date')
        data = visits.filter(
          (v) =>
            v.start_time.slice(0, 10) <= to && v.end_time.slice(0, 10) >= from,
        )
      } else if (p.endsWith('/notes')) data = { entries: [] }
      else if (p === '/api/clients') data = clients
      else if (p.includes('/care-need')) data = null
      else if (p === '/api/assignments')
        data = { today: '2026-11-02', assignments }
      else if (p === '/api/assignments/end-review')
        data = {
          review_token: 'review-token',
          stops_from: body.stops_from,
          assignments: assignments.filter((a) =>
            body.assignment_ids.includes(a.id),
          ),
          series_count: body.assignment_ids.length,
        }
      else {
        unexpected.push(`${method} ${p}`)
        return fail('Unexpected fixture request')
      }
      await r.fulfill({ json: data })
    })
    const profile = page.locator('.wp-page')
    await page.goto(`${base}/dashboard/workers/${worker.id}`)
    await profile.getByRole('heading', { name: 'This week' }).waitFor()
    await profile
      .getByText('12h below the weekly limit', { exact: true })
      .waitFor()
    assert.match(
      await profile.locator('.wp-hours').innerText(),
      /28h\s+scheduled \/ 40h weekly limit/,
    )
    assert.match(await profile.locator('.wp-days').innerText(), /Sun\s+1/)
    assert.equal(await profile.locator('.wp-client-row').count(), 2)
    if (output) {
      fs.mkdirSync(output, { recursive: true })
      await profile.screenshot({
        path: path.join(output, 'worker-profile-overview.png'),
      })
    }
    await profile.getByRole('button', { name: 'Contact Sarah' }).click()
    await page.getByRole('link', { name: 'sarah@example.test' }).waitFor()
    await page.keyboard.press('Escape')
    await profile
      .getByRole('button', { name: 'Schedule shift', exact: true })
      .click()
    await page.getByRole('combobox', { name: 'Worker', exact: true }).waitFor()
    assert.equal(
      await page
        .getByRole('combobox', { name: 'Worker', exact: true })
        .inputValue(),
      worker.id,
    )
    await page.getByRole('button', { name: 'Close new shift' }).click()
    await profile
      .getByRole('link', { name: 'Review document', exact: true })
      .click()
    let dialog = page.getByRole('dialog')
    const expiryInput = dialog.getByLabel('Expiry date')
    await expiryInput.fill('')
    await expiryInput.focus()
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.type('20281028')
    assert.equal(await expiryInput.inputValue(), '2028-10-28')
    await dialog
      .getByRole('button', { name: 'Verify document', exact: true })
      .click()
    await dialog.getByRole('alert').waitFor()
    assert.equal(
      await dialog.getByLabel('Expiry date').inputValue(),
      '2028-10-28',
    )
    verifyFails = false
    await dialog
      .getByRole('button', { name: 'Verify document', exact: true })
      .click()
    await dialog.waitFor({ state: 'hidden' })
    await profile.getByText('Expires Oct 28, 2028', { exact: true }).waitFor()
    await profile.getByRole('link', { name: 'Schedule', exact: true }).click()
    await profile.getByRole('button', { name: 'Edit availability' }).click()
    await dialog.getByLabel('From', { exact: true }).first().fill('08:30')
    await dialog.getByRole('button', { name: 'Save availability' }).click()
    await dialog.getByRole('alert').waitFor()
    assert.equal(
      await dialog.getByLabel('From', { exact: true }).first().inputValue(),
      '08:30',
    )
    availabilityFails = false
    await dialog.getByRole('button', { name: 'Save availability' }).click()
    await dialog.waitFor({ state: 'hidden' })
    await profile.getByText('8:30 am–5:00 pm', { exact: true }).waitFor()
    await profile
      .getByRole('link', { name: 'Assignments', exact: true })
      .click()
    await profile
      .getByRole('button', { name: 'Manage assignment', exact: true })
      .first()
      .click()
    await dialog.getByRole('checkbox').first().check()
    await dialog
      .getByLabel('Stop shifts from', { exact: false })
      .fill('2026-11-23')
    await dialog
      .getByLabel('Reason for the assignment history')
      .fill('Coverage transition')
    await dialog.getByRole('button', { name: 'Review change' }).click()
    await dialog
      .getByRole('heading', { name: 'Confirm assignment change' })
      .waitFor()
    assert.equal(
      writes.filter((w) => w.p === '/api/assignments/end-review').length,
      1,
    )
    await dialog.getByRole('button', { name: 'Close dialog' }).click()
    await profile
      .getByRole('link', { name: 'Attendance & leave', exact: true })
      .click()
    await profile.getByLabel('Attendance view', { exact: true }).selectOption('year')
    await profile.getByRole('heading', { name: 'Monthly breakdown' }).waitFor()
    assert.equal(await profile.locator('.wp-table tbody tr').count(), 12)
    await profile.getByRole('button', { name: 'November', exact: true }).click()
    assert.equal(
      await profile.getByLabel('Shift period', { exact: true }).inputValue(),
      '2026-11',
    )
    const metrics = profile.locator('.attendance-summary')
    const labels = await metrics.locator('.attendance-metric-label').evaluateAll(elements => elements.map(el => el.getBoundingClientRect().top))
    assert.ok(Math.max(...labels) - Math.min(...labels) < 2, 'Metric labels align')
    const numberTop = (await metrics.locator('strong').first().boundingBox()).y
    assert.ok(Math.abs((await metrics.locator('.attendance-ring').boundingBox()).y - numberTop) < 2, 'Ring aligns with metric values')
    for (const label of ['Dropped shifts breakdown', 'How attendance rate is calculated']) {
      const info = metrics.getByLabel(label, { exact: true })
      const tooltip = info.locator('..').getByRole('tooltip')
      assert.equal(await tooltip.isVisible(), false)
      await info.hover()
      await tooltip.waitFor({ state: 'visible' })
      await info.click()
      await profile.getByRole('heading', { name: 'Attendance & time away.' }).hover()
      assert.equal(await tooltip.isVisible(), false, 'Click does not latch the tooltip open')
      await info.focus()
      await tooltip.waitFor({ state: 'visible' })
      await info.evaluate(el => el.blur())
    }
    await profile.getByRole('button', { name: 'Record leave' }).click()
    for (const [label, digits, expected] of [['First day', '20261123', '2026-11-23'], ['Last day', '20261124', '2026-11-24']]) {
      const input = dialog.getByLabel(label)
      await input.focus()
      await page.keyboard.press('ArrowLeft')
      await page.keyboard.press('ArrowLeft')
      await page.keyboard.type(digits)
      assert.equal(await input.inputValue(), expected, `${label}: typing must advance after four year digits`)
    }
    await dialog.getByRole('button', { name: 'Review affected shifts', exact: true }).click()
    await dialog.getByRole('button', { name: 'Record leave', exact: true }).click()
    await dialog.getByRole('alert').waitFor()
    assert.equal(await dialog.getByLabel('Last day').inputValue(), '2026-11-24')
    leaveFails = false
    await dialog.getByRole('button', { name: 'Record leave', exact: true }).click()
    await dialog.waitFor({ state: 'hidden' })
    await profile
      .getByText('Nov 23, 2026–Nov 24, 2026', { exact: true })
      .waitFor()
    await profile.getByRole('button', { name: 'Profile & employment' }).click()
    await dialog.getByRole('link', { name: 'Edit profile' }).click()
    assert.equal(await profile.getByLabel('Hire date', { exact: true }).getAttribute('max'), '9999-12-31')
    assert.equal(await profile.getByLabel('Date of birth', { exact: true }).getAttribute('max'), '9999-12-31')
    await profile.getByLabel('First name', { exact: true }).fill('Sara')
    await profile.getByLabel('Phone number', { exact: true }).fill('')
    await profile.getByRole('button', { name: 'Save changes' }).click()
    await profile.getByRole('alert').waitFor()
    assert.equal(
      await profile.getByLabel('First name', { exact: true }).inputValue(),
      'Sara',
    )
    profileFails = false
    await profile.getByRole('button', { name: 'Save changes' }).click()
    await profile
      .getByRole('heading', { name: 'Sara Reid', exact: true })
      .waitFor()
    assert.equal(worker.phone_number, null)
    await page.goto(
      `${base}/dashboard/workers/${worker.id}/edit?document=first_aid_cpr`,
    )
    await dialog
      .getByRole('heading', { name: 'First Aid / CPR', exact: true })
      .waitFor()
    assert.match(page.url(), /\/documents\?document=first_aid_cpr/)
    await page.keyboard.press('Escape')
    await page.goto(`${base}/dashboard/workers/${worker.id}/leave`)
    await profile
      .getByRole('heading', { name: 'Leave records', exact: true })
      .waitFor()
    assert.match(page.url(), /\/attendance\?section=leave/)
    for (const width of [1024, 390]) {
      await page.setViewportSize({ width, height: 950 })
      for (const label of [
        'Overview',
        'Schedule',
        'Assignments',
        'Documents',
        'Attendance & leave',
      ]) {
        await profile.getByRole('link', { name: label, exact: true }).click()
        const bounds = await profile.evaluate((el) => ({
          width: el.clientWidth,
          scroll: el.scrollWidth,
        }))
        assert(
          bounds.scroll <= bounds.width + 1,
          `${width} ${label} overflows: ${JSON.stringify(bounds)}`,
        )
      }
      await profile.getByRole('link', { name: 'Overview', exact: true }).click()
      await page.locator('main').evaluate((el) => (el.scrollTop = 0))
      if (output)
        await page.screenshot({
          path: path.join(output, `worker-profile-${width}.png`),
        })
    }
    readsFail = true
    await page.goto(`${base}/dashboard/workers/${worker.id}/documents`)
    await profile.getByRole('alert').waitFor({ timeout: 20000 })
    assert.equal(
      await profile
        .getByRole('heading', { name: 'On file', exact: true })
        .count(),
      0,
    )
    readsFail = false
    await profile
      .getByRole('button', { name: 'Try again', exact: true })
      .click()
    await profile
      .getByRole('heading', { name: 'On file', exact: true })
      .waitFor()
    await profile
      .getByRole('button', { name: 'Manage First Aid / CPR' })
      .click()
    await dialog.getByLabel('Expiry date').fill('2029-10-28')
    readsFail = true
    // A failed background refresh must preserve the open review and its draft.
    await page.clock.setFixedTime(new Date('2026-11-02T11:06:00Z'))
    await page.evaluate(() => window.dispatchEvent(new Event('offline')))
    await page.evaluate(() => window.dispatchEvent(new Event('online')))
    await profile.locator('[role="alert"]').waitFor({ timeout: 20000 })
    assert.equal(
      await dialog.getByLabel('Expiry date').inputValue(),
      '2029-10-28',
    )
    readsFail = false
    await dialog.getByRole('button', { name: 'Save expiry date' }).click()
    await dialog.waitFor({ state: 'hidden' })
    if (output) {
      await page.locator('main').evaluate((el) => (el.scrollTop = 0))
      await page.screenshot({
        path: path.join(output, 'worker-documents-390.png'),
      })
    }
    assert.deepEqual(errors, [])
    assert.deepEqual(unexpected, [])
    console.log(
      'PASS: real worker routes, agency dates, hours, contacts, preselected scheduling, document/availability/profile/leave save recovery, assignment review, compatibility links, failed reads and responsive layout.',
    )
  } finally {
    await browser.close()
  }
}
run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
