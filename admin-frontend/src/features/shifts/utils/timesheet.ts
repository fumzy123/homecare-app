import { format, startOfWeek, endOfWeek } from 'date-fns'
import { WEEK_STARTS_ON } from '@/shared/lib/date'
import type { ShiftOccurrence } from '@/features/shifts/api'

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

export function exportCsv(rows: ShiftOccurrence[], from: string, to: string) {
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
  const csv  = [headers, ...lines].map((row) => row.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `timesheet-${from}-to-${to}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
