import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test } from 'vitest'
import { CareRequestReview } from '../src/features/placements/components/CareRequestReview'

const messages = {
  availability: 'Wed: requested 09:00–11:00. Worker availability: 13:00–17:00.',
  conflicts: 'First conflicting visit: Other client on 2026-10-28, 09:30–12:00. This overlaps the selected care.',
  hours: "Week 2026-10-25–2026-10-31: 20h already scheduled + 2h selected = 22h. This exceeds the worker’s maximum weekly hours of 20h by 2h.",
}
const gates = { availability: 'availability_ok', conflicts: 'no_conflicts', hours: 'within_hours' }
const labels = ['Worker availability', 'Visit conflicts', 'Weekly hours']

async function review(failed, assertion, legacy = false) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const originalScroll = HTMLElement.prototype.scrollIntoView
  HTMLElement.prototype.scrollIntoView = () => {}
  const eligibility = {
    availability_ok: true, no_conflicts: true, within_hours: true,
    all_clear: failed.length === 0,
    reasons: failed.map(key => messages[key]),
    ...Object.fromEntries(failed.map(key => [gates[key], false])),
    ...(!legacy && { check_details: Object.fromEntries(Object.keys(gates).map(key => [key, failed.includes(key) ? [messages[key]] : []])) }),
  }
  try {
    await act(async () => root.render(<CareRequestReview
      request={{ client_first_name: 'Test', client_last_name: 'Client', care_slots: [] }}
      preview={{ starts_on: '2026-10-26', ends_previous_schedule: false, old_shifts: [], uncovered_slots: [], all_clear: eligibility.all_clear,
        workers: [{ worker_id: 'worker', worker_name: 'Sam Demo', eligibility }] }}
      selections={[]} busy={false} acceptGaps={false} stale={false} error=""
      confirmArranged={false} onConfirmArranged={() => {}} onAcceptGaps={() => {}}
      onBack={() => {}} onApprove={() => {}}
    />))
    const approve = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Approve and schedule'))
    expect(approve.disabled).toBe(failed.length > 0)
    assertion(container)
  } finally {
    await act(async () => root.unmount())
    container.remove()
    HTMLElement.prototype.scrollIntoView = originalScroll
  }
}

test.each(Object.keys(gates))('%s failure is explained only in its own highlighted row', async key => {
  await review([key], container => {
    const rows = [...container.querySelectorAll('.cr-check-result')]
    expect(rows).toHaveLength(3)
    rows.forEach((row, index) => {
      const failed = index === Object.keys(gates).indexOf(key)
      expect(row.querySelector('dt').textContent).toContain(labels[index])
      expect(row.classList.contains('cr-check-failed')).toBe(failed)
      expect(row.querySelector('.cr-check-status').textContent).toBe(failed ? 'Needs attention' : 'Passed')
      expect(row.textContent.includes(messages[key])).toBe(failed)
    })
    expect(container.querySelectorAll('.cr-check-reasons li')).toHaveLength(1)
  })
})

test('simultaneous failures stay attached to their respective checks', async () => {
  await review(Object.keys(gates), container => {
    expect(container.querySelectorAll('.cr-check-failed')).toHaveLength(3)
    expect(container.querySelectorAll('.cr-check-reasons li')).toHaveLength(3)
    const rows = [...container.querySelectorAll('.cr-check-result')]
    Object.keys(gates).forEach((key, index) => expect(rows[index].querySelector('dd').textContent).toContain(messages[key]))
  })
})

test('passed checks remain neutral and allow approval', async () => {
  await review([], container => {
    expect(container.querySelectorAll('.cr-check-failed')).toHaveLength(0)
    expect(container.querySelectorAll('.cr-check-status')).toHaveLength(3)
    expect(container.textContent).toContain('Checks passed')
  })
})

test('a legacy single failure still appears with the failed check', async () => {
  await review(['conflicts'], container => {
    expect(container.querySelector('.cr-check-failed').textContent).toContain(messages.conflicts)
  }, true)
})


test('missing availability warns and requires direct-arrangement and gap confirmations', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const originalScroll = HTMLElement.prototype.scrollIntoView
  HTMLElement.prototype.scrollIntoView = () => {}
  let approvals = 0
  function Harness() {
    const [confirmed, setConfirmed] = React.useState(false)
    const [gaps, setGaps] = React.useState(false)
    return <CareRequestReview
      request={{ client_first_name: 'Test', client_last_name: 'Client', care_slots: [] }}
      preview={{ starts_on: '2026-11-02', ends_previous_schedule: false, old_shifts: [],
        uncovered_slots: [{ id: 'open', day_of_week: 'WE', start_time: '09:00', end_time: '11:00' }], all_clear: true,
        workers: [{ worker_id: 'worker', worker_name: 'Sam Demo', eligibility: {
          availability_ok: false, availability_requires_admin_confirmation: true,
          no_conflicts: true, within_hours: true, all_clear: true, reasons: [],
          check_details: { availability: ['No availability is recorded. Confirm the directly arranged recurring coverage.'], conflicts: [], hours: [] },
        } }] }}
      selections={[{care_slot_id: 'monday', employment_id: 'worker', assignment_source: 'admin_arranged'}]}
      busy={false} acceptGaps={gaps} stale={false} error="" confirmArranged={confirmed}
      onConfirmArranged={setConfirmed} onAcceptGaps={setGaps} onBack={() => {}} onApprove={() => { approvals++ }}
    />
  }
  try {
    await act(async () => root.render(<Harness />))
    expect(container.querySelectorAll('.cr-check-failed')).toHaveLength(0)
    expect(container.querySelector('.cr-check-warning').textContent).toContain('Admin confirmation required')
    expect(container.textContent).toContain('Ready for admin confirmation')
    expect(container.textContent).toContain('weekly care request')
    const approve = [...container.querySelectorAll('button')].find(b => b.textContent.includes('Approve and schedule'))
    const boxes = container.querySelectorAll('input[type="checkbox"]')
    expect(approve.disabled).toBe(true)
    await act(async () => boxes[0].click())
    expect(approve.disabled).toBe(true)
    await act(async () => boxes[1].click())
    expect(approve.disabled).toBe(false)
    await act(async () => approve.click())
    expect(approvals).toBe(1)
    await act(async () => boxes[0].click())
    expect(approve.disabled).toBe(true)
  } finally {
    await act(async () => root.unmount())
    container.remove()
    HTMLElement.prototype.scrollIntoView = originalScroll
  }
})
