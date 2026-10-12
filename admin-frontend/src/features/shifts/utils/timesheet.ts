import { format, startOfWeek, endOfWeek } from 'date-fns'
import { WEEK_STARTS_ON } from '@/shared/lib/date'
import type { ShiftOccurrence } from '@/features/shifts/api'
import { serializeCsv } from '@/shared/lib/csv'
import type { Table } from '@tanstack/react-table'

export function filterTimesheetStatus(rows: ShiftOccurrence[], status: string): ShiftOccurrence[] {
  return status ? rows.filter(row => row.completion_status === status) : rows
}

export function exportTimesheetView(table: Pick<Table<ShiftOccurrence>, 'getRowModel'>, from: string, to: string) {
  exportCsv(table.getRowModel().rows.map(row => row.original), from || '2020-01-01', to || '2030-12-31')
}

export function toDateInput(d: Date) {
  return format(d, 'yyyy-MM-dd')
}

export function useTimesheetDefaults() {
  return {
    fromDate: toDateInput(startOfWeek(new Date(), { weekStartsOn: WEEK_STARTS_ON })),
    toDate:   toDateInput(endOfWeek(new Date(),   { weekStartsOn: WEEK_STARTS_ON })),
  }
}

function computeHours(start: string, end: string, status?: string): number {
  const NON_BILLABLE = new Set(['no_show', 'cancelled'])
  if (status && NON_BILLABLE.has(status)) return 0
  const ms = new Date(end).getTime() - new Date(start).getTime()
  return Math.round((ms / 1000 / 3600) * 100) / 100
}

export function buildTimesheetCsv(rows: ShiftOccurrence[]): string {
  const headers = ['Date', 'Worker', 'Client', 'Start', 'End', 'Hours', 'Status']
  const lines = rows.map((r) => [
    r.date,
    `${r.worker.first_name} ${r.worker.last_name}`,
    `${r.client.first_name} ${r.client.last_name}`,
    format(new Date(r.start_time), 'h:mm a'),
    format(new Date(r.end_time), 'h:mm a'),
    computeHours(r.start_time, r.end_time, r.completion_status).toFixed(2),
    r.completion_status,
  ])
  return serializeCsv([headers, ...lines])
}

export function exportCsv(rows: ShiftOccurrence[], from: string, to: string) {
  const blob = new Blob([buildTimesheetCsv(rows)], { type: 'text/csv;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `timesheet-${from}-to-${to}.csv`
  try {
    document.body.appendChild(a)
    a.click()
  } finally {
    a.remove()
    // Let the browser consume the URL before releasing its backing data.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}
