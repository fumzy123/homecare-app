import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, getWeek } from 'date-fns'
import { shiftsApi, type ShiftOccurrence } from '@/features/shifts/api'
import { ShiftDetailDrawer } from '@/features/shifts/components/ShiftDetailDrawer'
import { Kicker } from '@/shared/components/ui'

export const Route = createFileRoute('/_protected/dashboard/clients/$clientId/')({
  component: ClientOverview,
})

type Period = 'this_week' | 'this_month' | 'last_90' | 'all_time'

const PERIODS: { key: Period; label: string }[] = [
  { key: 'this_week',  label: 'This week'     },
  { key: 'this_month', label: 'This month'    },
  { key: 'last_90',    label: 'Last 3 months' },
  { key: 'all_time',   label: 'All time'      },
]

const PERIOD_TITLE: Record<Period, string> = {
  this_week:  'this week',
  this_month: 'this month',
  last_90:    'last 3 months',
  all_time:   'all time',
}

const now        = new Date()
const weekStart  = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
const weekEnd    = format(endOfWeek(now,   { weekStartsOn: 1 }), 'yyyy-MM-dd')
const monthStart = format(startOfMonth(now), 'yyyy-MM-dd')
const monthEnd   = format(endOfMonth(now),   'yyyy-MM-dd')
const weekNum    = getWeek(now, { weekStartsOn: 1 })

function getDateRange(period: Period): { from: string; to: string } {
  switch (period) {
    case 'this_week':  return { from: weekStart, to: weekEnd }
    case 'this_month': return { from: monthStart, to: monthEnd }
    case 'last_90':    return { from: format(subDays(now, 90), 'yyyy-MM-dd'), to: format(now, 'yyyy-MM-dd') }
    case 'all_time':   return { from: '2020-01-01', to: '2030-12-31' }
  }
}

function sumHours(shifts: ShiftOccurrence[]): number {
  return shifts
    .filter(s => !['cancelled', 'dropped'].includes(s.completion_status))
    .reduce((sum, s) => sum + (new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 3_600_000, 0)
}

const STATUS_CONFIG: Record<string, { bg: string; label: string }> = {
  completed:   { bg: 'bg-ink',     label: 'COMPLETED'   },
  in_progress: { bg: 'bg-mint',    label: 'IN PROGRESS' },
  scheduled:   { bg: 'bg-orange',  label: 'SCHEDULED'   },
  no_show:     { bg: 'bg-orange',  label: 'NO SHOW'     },
  cancelled:   { bg: 'bg-cream-2', label: 'CANCELLED'   },
  dropped:     { bg: 'bg-yellow',  label: 'DROPPED'     },
}

function StatusCell({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { bg: 'bg-cream-2', label: status.toUpperCase() }
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 border border-ink/20 ${cfg.bg}`} />
      <span className="font-mono text-[9px] tracking-[0.08em] uppercase text-ink-soft">{cfg.label}</span>
    </div>
  )
}

function ClientOverview() {
  const { clientId } = Route.useParams()
  const [period, setPeriod] = useState<Period>('this_week')
  const [selectedShift, setSelectedShift] = useState<ShiftOccurrence | null>(null)

  const { from, to } = getDateRange(period)

  const { data: stats } = useQuery({
    queryKey: ['shift-stats', from, to, '', clientId],
    queryFn: () => shiftsApi.getShiftStats(from, to, undefined, clientId),
  })

  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ['shifts', from, to, '', clientId],
    queryFn: () => shiftsApi.listShifts(from, to, undefined, clientId),
  })

  const periodHrs    = Math.round(sumHours(shifts))
  const upcoming     = (stats?.scheduled ?? 0) + (stats?.in_progress ?? 0)
  const completed    = stats?.completed ?? 0
  const cancelled    = stats?.cancelled ?? 0
  const hoursDelivered = shifts
    .filter(s => s.completion_status === 'completed')
    .reduce((sum, s) => sum + (new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 3_600_000, 0)

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

  const sorted = [...shifts].sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())

  return (
    <div className="p-10 space-y-8">

      {/* ── Utilization header ── */}
      <div className="border border-ink bg-paper">
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink">
          <Kicker>Utilization / Week {weekNum}</Kicker>
          <span className="font-mono text-[11px] text-ink-soft">
            <span className="text-ink font-bold">{hoursDelivered.toFixed(1)}</span>h delivered
          </span>
        </div>
      </div>

      {/* ── Period toggle + stats ── */}
      <div>
        <div className="flex items-center gap-2 mb-5">
          {PERIODS.map(({ key, label }) => (
            <button key={key} onClick={() => setPeriod(key)}
              className={`px-3.5 py-1.5 font-mono text-[10px] tracking-[0.05em] uppercase transition-colors border ${
                period === key ? 'bg-ink text-cream border-ink' : 'border-ink text-ink-soft hover:text-ink hover:bg-cream-2'
              }`}>
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-4 border border-ink bg-paper">
          {[
            { label: 'Upcoming',       value: upcoming,                    sub: 'scheduled visits'  },
            { label: 'Completed',      value: completed,                   sub: 'visits'            },
            { label: 'Hours Delivered',value: `${hoursDelivered.toFixed(1)}h`, sub: 'of completed care' },
            { label: 'Cancelled',      value: cancelled,                   sub: 'visits'            },
          ].map((s, i) => (
            <div key={s.label} className={`px-6 py-5 ${i < 3 ? 'border-r border-ink' : ''}`}>
              <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft mb-3">{s.label}</p>
              <p className="font-serif text-[40px] leading-none">{s.value}</p>
              <p className="font-mono text-[10px] text-ink-soft mt-1">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Top workers ── */}
      {topWorkers.length > 0 && (
        <div className="border border-ink bg-paper">
          <div className="px-6 py-4 border-b border-ink">
            <Kicker>Top workers · completed visits</Kicker>
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

      {/* ── Visit history ── */}
      <div className="border border-ink bg-paper">
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink">
          <h2 className="font-serif text-[26px] leading-none tracking-[-0.02em]">
            Visits <span className="italic text-muted">{PERIOD_TITLE[period]}</span>
          </h2>
          <span className="font-mono text-[11px] text-ink-soft">
            <span className="text-ink font-bold">{periodHrs}</span>h total
          </span>
        </div>

        {isLoading ? (
          <p className="px-6 py-8 font-mono text-[10px] text-muted text-center tracking-wide">LOADING…</p>
        ) : sorted.length === 0 ? (
          <p className="px-6 py-8 font-mono text-[10px] text-muted text-center tracking-wide">NO VISITS IN THIS PERIOD</p>
        ) : (
          <div className="px-6 py-5">
            <div className="grid grid-cols-5 gap-6 pb-2 border-b border-ink">
              {['Date', 'Worker', 'Time', 'Hours', 'Status'].map(h => (
                <p key={h} className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft">{h}</p>
              ))}
            </div>
            {sorted.map((shift, i) => {
              const hrs = ((new Date(shift.end_time).getTime() - new Date(shift.start_time).getTime()) / 3_600_000).toFixed(1)
              return (
                <div
                  key={`${shift.shift_id}-${shift.date}`}
                  onClick={() => setSelectedShift(shift)}
                  className={`grid grid-cols-5 gap-6 py-3 cursor-pointer hover:bg-cream-2 transition-colors ${i > 0 ? 'border-t border-dashed border-line-soft' : ''}`}
                >
                  <p className="font-mono text-[11px]">{format(new Date(shift.date), 'MMM d, yyyy')}</p>
                  <p className="text-[12px]">{shift.worker.first_name} {shift.worker.last_name}</p>
                  <p className="font-mono text-[11px] text-ink-soft">
                    {format(new Date(shift.start_time), 'HH:mm')} – {format(new Date(shift.end_time), 'HH:mm')}
                  </p>
                  <p className="font-mono text-[11px]">{hrs}h</p>
                  <StatusCell status={shift.completion_status} />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {selectedShift && (
        <ShiftDetailDrawer shift={selectedShift} onClose={() => setSelectedShift(null)} />
      )}
    </div>
  )
}
