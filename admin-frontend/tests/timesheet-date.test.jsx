import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test, vi } from 'vitest'
import { TimesheetTable } from '../src/features/shifts/components/TimesheetTable'

vi.mock('../src/features/shifts/hooks/useTimesheetShifts', () => ({ useTimesheetShifts: () => ({ data: [{
  shift_id: 'visit', date: '2026-10-14', start_time: '2026-10-14T09:00:00', end_time: '2026-10-14T10:00:00',
  completion_status: 'completed', worker: { first_name: 'Test', last_name: 'Worker' },
  client: { first_name: 'Test', last_name: 'Client' },
}], isPending: false, isFetching: false, isError: false }) }))
vi.mock('../src/features/workers/hooks/useWorkers', () => ({ useWorkers: () => ({ data: [] }) }))
vi.mock('../src/features/clients/hooks/useClients', () => ({ useClients: () => ({ data: [] }) }))
vi.mock('../src/features/shifts/components/ShiftDetailDrawer', () => ({ ShiftDetailDrawer: () => null }))
vi.mock('../src/shared/components/ui', () => ({
  Card: ({ children }) => <div>{children}</div>,
  ShiftStatusBadge: ({ status }) => <span>{status}</span>,
  DateInput: () => null,
  Btn: ({ children, variant: _variant, ...props }) => <button {...props}>{children}</button>,
}))

test('timesheet preserves the occurrence calendar date', async () => {
  // Run with TZ=America/St_Johns so parsing a date as UTC reproduces the regression.
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<TimesheetTable fromDate="2026-10-11" toDate="2026-10-17" onFromChange={() => {}} onToChange={() => {}} />))
    expect(container.querySelector('tbody tr td').textContent).toBe('Oct 14, 2026')
    expect(container.textContent).toContain('1.00 h')
  } finally {
    await act(async () => root.unmount())
    container.remove()
  }
})
