import { useQuery } from '@tanstack/react-query'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, getWeek } from 'date-fns'
import { WEEK_STARTS_ON } from '@/shared/lib/date'
import { shiftsApi } from '@/features/shifts/api'
import { sumHours } from '@/features/shifts/utils/aggregations'
import { StatCard, PeriodToggle } from '@/shared/components/ui'

type Period = 'this_week' | 'this_month' | 'last_90' | 'all_time'

const PERIODS: { key: Period; label: string }[] = [
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
const weekNum    = getWeek(now, { weekStartsOn: WEEK_STARTS_ON })

function getDateRange(period: Period) {
  switch (period) {
    case 'this_week':  return { from: weekStart, to: weekEnd }
    case 'this_month': return { from: monthStart, to: monthEnd }
    case 'last_90':    return { from: format(subDays(now, 90), 'yyyy-MM-dd'), to: format(now, 'yyyy-MM-dd') }
    case 'all_time':   return { from: '2020-01-01', to: '2030-12-31' }
  }
}

interface WorkerStatsSectionProps {
  workerId: string
  period: Period
  onPeriodChange: (p: Period) => void
}

export function WorkerStatsSection({ workerId, period, onPeriodChange }: WorkerStatsSectionProps) {
  const { from, to } = getDateRange(period)

  const { data: shifts = [] } = useQuery({
    queryKey: ['shifts', from, to, workerId, ''],
    queryFn:  () => shiftsApi.listShifts(from, to, workerId),
  })

  const periodHrs   = Math.round(sumHours(shifts))
  const topClients  = Object.values(
    shifts
      .filter(s => s.completion_status === 'completed')
      .reduce<Record<string, { name: string; count: number }>>((acc, s) => {
        const id = s.client.id
        if (!acc[id]) acc[id] = { name: `${s.client.first_name} ${s.client.last_name}`, count: 0 }
        acc[id].count++
        return acc
      }, {})
  ).sort((a, b) => b.count - a.count).slice(0, 3)

  return (
    <div className="space-y-8">
      {/* Period toggle */}
      <div className="border border-ink bg-paper">
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink">
          <PeriodToggle options={PERIODS} value={period} onChange={onPeriodChange} />
          <span className="font-mono text-[11px] text-ink-soft">
            <span className="text-ink font-bold">{periodHrs}</span>h · Week {weekNum}
          </span>
        </div>
        <div className="grid grid-cols-1 px-6 py-4">
          <StatCard label="Hours scheduled" value={`${periodHrs}h`} sub="non-cancelled shifts" size="sm" />
        </div>
      </div>

      {/* Top clients */}
      {topClients.length > 0 && (
        <div className="border border-ink bg-paper">
          <div className="px-6 py-4 border-b border-ink">
            <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft">Top clients · completed visits</p>
          </div>
          {topClients.map((c, i) => (
            <div key={c.name} className={`flex items-center gap-4 px-6 py-3 ${i > 0 ? 'border-t border-dashed border-line-soft' : ''}`}>
              <span className="font-mono text-[10px] text-muted w-4">{i + 1}</span>
              <span className="flex-1 text-[13px]">{c.name}</span>
              <span className="font-mono text-[11px] font-bold">{c.count}</span>
              <span className="font-mono text-[10px] text-ink-soft">visits</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export { type Period, PERIODS, getDateRange }
