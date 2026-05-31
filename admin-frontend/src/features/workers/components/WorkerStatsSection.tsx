import { differenceInDays } from 'date-fns'
import { useQuery } from '@tanstack/react-query'
import { shiftsApi } from '@/features/shifts/api'
import { sumHours } from '@/features/shifts/utils/aggregations'
import { PeriodToggle } from '@/shared/components/ui'
import { type Period, PERIODS, getDateRange, getDateRangeLabel } from '@/features/shifts/utils/period'
import { orgMembersApi } from '@/features/org-members/api'

interface WorkerStatsSectionProps {
  workerId: string
  period: Period
  onPeriodChange: (p: Period) => void
}

// Returns how many weeks are covered by the selected period.
// For all_time, anchors to the worker's hire date so we don't divide by
// a fake 10-year window.
function weeksInPeriod(period: Period, hireDate: string | null | undefined): number {
  if (period === 'this_week') return 1
  if (period === 'all_time') {
    if (!hireDate) return 1
    const days = Math.max(7, differenceInDays(new Date(), new Date(hireDate)))
    return days / 7
  }
  const { from, to } = getDateRange(period)
  return (differenceInDays(new Date(to), new Date(from)) + 1) / 7
}

export function WorkerStatsSection({ workerId, period, onPeriodChange }: WorkerStatsSectionProps) {
  const { from, to } = getDateRange(period)

  const { data: shifts = [] } = useQuery({
    queryKey: ['shifts', from, to, workerId, ''],
    queryFn: () => shiftsApi.listShifts(from, to, workerId),
  })

  const { data: worker } = useQuery({
    queryKey: ['worker', workerId],
    queryFn: () => orgMembersApi.getOrgMember(workerId),
  })

  const activeShifts   = shifts.filter(s => !['cancelled', 'dropped'].includes(s.completion_status))
  const periodHrs      = Math.round(sumHours(shifts) * 10) / 10
  const shiftsCount    = activeShifts.length
  const clientsCount   = new Set(activeShifts.map(s => s.client.id)).size
  const maxHrs         = worker?.max_hours_per_week ?? null
  const weeks          = weeksInPeriod(period, worker?.hire_date)
  const capacityHrs    = maxHrs ? maxHrs * weeks : null
  const utilization    = capacityHrs ? Math.round((periodHrs / capacityHrs) * 100) : null
  const isWeekly       = period === 'this_week'

  const stats = [
    { label: 'Hours scheduled', value: `${periodHrs}h`,                               sub: 'non-cancelled' },
    { label: 'Shifts',          value: String(shiftsCount),                            sub: PERIODS.find(p => p.key === period)!.label.toLowerCase() },
    { label: 'Clients',         value: String(clientsCount),                           sub: 'served' },
    {
      label: isWeekly ? 'Utilization' : 'Avg utilization',
      value: utilization !== null ? `${utilization}%` : '—',
      sub:   maxHrs ? (isWeekly ? `of ${maxHrs}h max` : `avg of ${maxHrs}h/wk cap`) : 'no cap set',
      orange: true,
    },
  ]

  return (
    <div className="border border-ink bg-paper">
      <div className="flex items-center justify-between px-6 py-4 border-b border-ink">
        <PeriodToggle options={PERIODS} value={period} onChange={onPeriodChange} />
        <span className="font-mono text-[11px] text-ink-soft">{getDateRangeLabel(period)}</span>
      </div>
      <div className="grid grid-cols-4 divide-x divide-line-soft">
        {stats.map(({ label, value, sub, orange }) => (
          <div key={label} className="px-6 py-[18px]">
            <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft mb-2">{label}</p>
            <p className={`font-serif text-[40px] font-medium leading-none ${orange ? 'text-orange' : ''}`}>{value}</p>
            <p className="font-mono text-[10px] text-muted mt-1">{sub}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
