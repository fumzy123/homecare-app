import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, getWeek } from 'date-fns'
import { WEEK_STARTS_ON } from '@/shared/lib/date'

export type Period = 'this_week' | 'this_month' | 'last_90' | 'all_time'

export const PERIODS: { key: Period; label: string }[] = [
  { key: 'this_week',  label: 'This week'     },
  { key: 'this_month', label: 'This month'    },
  { key: 'last_90',    label: 'Last 3 months' },
  { key: 'all_time',   label: 'All time'      },
]

const now        = new Date()
const weekStart  = format(startOfWeek(now, { weekStartsOn: WEEK_STARTS_ON }), 'yyyy-MM-dd')
const weekEnd    = format(endOfWeek(now,   { weekStartsOn: WEEK_STARTS_ON }), 'yyyy-MM-dd')
const monthStart = format(startOfMonth(now), 'yyyy-MM-dd')
const monthEnd   = format(endOfMonth(now),   'yyyy-MM-dd')

export const weekNum = getWeek(now, { weekStartsOn: WEEK_STARTS_ON })

export function getDateRange(period: Period): { from: string; to: string } {
  switch (period) {
    case 'this_week':  return { from: weekStart, to: weekEnd }
    case 'this_month': return { from: monthStart, to: monthEnd }
    case 'last_90':    return { from: format(subDays(now, 90), 'yyyy-MM-dd'), to: format(now, 'yyyy-MM-dd') }
    case 'all_time':   return { from: '2020-01-01', to: '2030-12-31' }
  }
}
