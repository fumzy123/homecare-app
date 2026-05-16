import { useQuery } from '@tanstack/react-query'
import { shiftsApi } from '@/features/shifts/api'
import { sumHours } from '@/features/shifts/utils/aggregations'
import { StatCard, PeriodToggle } from '@/shared/components/ui'
import { type Period, PERIODS, getDateRange, getDateRangeLabel } from '@/features/shifts/utils/period'

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

  const periodHrs = Math.round(sumHours(shifts))

  return (
    <div className="border border-ink bg-paper">
      <div className="flex items-center justify-between px-6 py-4 border-b border-ink">
        <PeriodToggle options={PERIODS} value={period} onChange={onPeriodChange} />
        <span className="font-mono text-[11px] text-ink-soft">{getDateRangeLabel(period)}</span>
      </div>
      <div className="grid grid-cols-1 px-6 py-4">
        <StatCard label="Hours scheduled" value={`${periodHrs}h`} sub="non-cancelled shifts" size="sm" />
      </div>
    </div>
  )
}

