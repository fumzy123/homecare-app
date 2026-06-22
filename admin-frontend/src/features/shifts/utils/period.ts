import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, getWeek } from 'date-fns'
import { WEEK_STARTS_ON } from '@/shared/lib/date'

export type Period = 'this_week' | 'this_month' | 'last_90' | 'this_year' | 'all_time'

// Default toggle set (kept unchanged for existing stat sections).
export const PERIODS: { key: Period; label: string }[] = [
  { key: 'this_week',  label: 'This week'     },
  { key: 'this_month', label: 'This month'    },
  { key: 'last_90',    label: 'Last 3 months' },
  { key: 'all_time',   label: 'All time'      },
]

// Fuller set used by Care Metrics, which also offers a custom range alongside.
export const CARE_METRIC_PERIODS: { key: Period; label: string }[] = [
  { key: 'this_week',  label: 'This week'     },
  { key: 'this_month', label: 'This month'    },
  { key: 'last_90',    label: 'Last 90 days'  },
  { key: 'this_year',  label: 'This year'     },
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
    case 'this_year':  return { from: format(startOfYear(now), 'yyyy-MM-dd'), to: format(endOfYear(now), 'yyyy-MM-dd') }
    case 'all_time':   return { from: '2020-01-01', to: '2030-12-31' }
  }
}

export function getDateRangeLabel(period: Period): string {
  switch (period) {
    case 'this_week': {
      const ws = startOfWeek(now, { weekStartsOn: WEEK_STARTS_ON })
      const we = endOfWeek(now,   { weekStartsOn: WEEK_STARTS_ON })
      if (format(ws, 'MMM yyyy') === format(we, 'MMM yyyy'))
        return `${format(ws, 'MMM d')} – ${format(we, 'd, yyyy')}`
      return `${format(ws, 'MMM d')} – ${format(we, 'MMM d, yyyy')}`
    }
    case 'this_month':
      return format(now, 'MMMM yyyy')
    case 'last_90': {
      const from = subDays(now, 90)
      if (format(from, 'yyyy') === format(now, 'yyyy'))
        return `${format(from, 'MMM d')} – ${format(now, 'MMM d, yyyy')}`
      return `${format(from, 'MMM d, yyyy')} – ${format(now, 'MMM d, yyyy')}`
    }
    case 'this_year':
      return format(now, 'yyyy')
    case 'all_time':
      return 'All time'
  }
}
