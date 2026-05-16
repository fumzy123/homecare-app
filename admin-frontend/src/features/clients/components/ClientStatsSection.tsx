import { useQuery } from '@tanstack/react-query'
import { shiftsApi } from '@/features/shifts/api'
import { StatCard, PeriodToggle } from '@/shared/components/ui'
import { type Period, PERIODS, getDateRange, weekNum } from '@/features/shifts/utils/period'

interface ClientStatsSectionProps {
  clientId: string
  period: Period
  onPeriodChange: (p: Period) => void
}

export function ClientStatsSection({ clientId, period, onPeriodChange }: ClientStatsSectionProps) {
  const { from, to } = getDateRange(period)

  const { data: stats } = useQuery({
    queryKey: ['shift-stats', from, to, '', clientId],
    queryFn:  () => shiftsApi.getShiftStats(from, to, undefined, clientId),
  })

  const { data: shifts = [] } = useQuery({
    queryKey: ['shifts', from, to, '', clientId],
    queryFn:  () => shiftsApi.listShifts(from, to, undefined, clientId),
  })

  const hoursDelivered = shifts
    .filter(s => s.completion_status === 'completed')
    .reduce((sum, s) => sum + (new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 3_600_000, 0)

  const upcoming  = (stats?.scheduled ?? 0) + (stats?.in_progress ?? 0)
  const completed = stats?.completed ?? 0
  const cancelled = stats?.cancelled ?? 0

  const topWorkers = Object.values(
    shifts
      .filter(s => s.completion_status === 'completed')
      .reduce<Record<string, { name: string; count: number }>>((acc, s) => {
        const id = s.worker.id
        if (!acc[id]) acc[id] = { name: `${s.worker.first_name} ${s.worker.last_name}`, count: 0 }
        acc[id].count++
        return acc
      }, {})
  ).sort((a, b) => b.count - a.count).slice(0, 3)

  return (
    <div className="space-y-8">
      {/* Utilization header */}
      <div className="border border-ink bg-paper">
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink">
          <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft">Utilization / Week {weekNum}</p>
          <span className="font-mono text-[11px] text-ink-soft">
            <span className="text-ink font-bold">{hoursDelivered.toFixed(1)}</span>h delivered
          </span>
        </div>
      </div>

      {/* Period toggle + stats */}
      <div>
        <div className="mb-5">
          <PeriodToggle options={PERIODS} value={period} onChange={onPeriodChange} />
        </div>
        <div className="grid grid-cols-4 border border-ink bg-paper">
          {[
            { label: 'Upcoming',        value: upcoming,                        sub: 'scheduled visits'  },
            { label: 'Completed',       value: completed,                       sub: 'visits'            },
            { label: 'Hours Delivered', value: `${hoursDelivered.toFixed(1)}h`, sub: 'of completed care' },
            { label: 'Cancelled',       value: cancelled,                       sub: 'visits'            },
          ].map((s, i) => (
            <StatCard key={s.label} label={s.label} value={s.value} sub={s.sub} size="sm"
              className={i < 3 ? 'border-r border-ink' : ''} />
          ))}
        </div>
      </div>

      {/* Top workers */}
      {topWorkers.length > 0 && (
        <div className="border border-ink bg-paper">
          <div className="px-6 py-4 border-b border-ink">
            <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft">Top workers · completed visits</p>
          </div>
          {topWorkers.map((w, i) => (
            <div key={w.name} className={`flex items-center gap-4 px-6 py-3 ${i > 0 ? 'border-t border-dashed border-line-soft' : ''}`}>
              <span className="font-mono text-[10px] text-muted w-4">{i + 1}</span>
              <span className="flex-1 text-[13px]">{w.name}</span>
              <span className="font-mono text-[11px] font-bold">{w.count}</span>
              <span className="font-mono text-[10px] text-ink-soft">visits</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
