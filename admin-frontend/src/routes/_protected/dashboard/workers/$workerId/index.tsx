import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns'
import { WEEK_STARTS_ON } from '@/shared/lib/date'
import { shiftsApi, type ShiftOccurrence } from '@/features/shifts/api'
import { ShiftDetailDrawer } from '@/features/shifts/components/ShiftDetailDrawer'
import { Kicker, ShiftStatusBadge } from '@/shared/components/ui'

export const Route = createFileRoute('/_protected/dashboard/workers/$workerId/')({
  component: WorkerOverview,
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
const weekStart  = format(startOfWeek(now, { weekStartsOn: WEEK_STARTS_ON }), 'yyyy-MM-dd')
const weekEnd    = format(endOfWeek(now,   { weekStartsOn: WEEK_STARTS_ON }), 'yyyy-MM-dd')
const monthStart = format(startOfMonth(now), 'yyyy-MM-dd')
const monthEnd   = format(endOfMonth(now),   'yyyy-MM-dd')

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

function StatusCell({ status }: { status: string }) {
  return <ShiftStatusBadge status={status} />
}

function WorkerOverview() {
  const { workerId } = Route.useParams()
  const [period, setPeriod] = useState<Period>('this_week')
  const [filterStatus, setFilterStatus] = useState('')
  const [selectedShift, setSelectedShift] = useState<ShiftOccurrence | null>(null)

  const { from, to } = getDateRange(period)

  const { data: periodShifts = [], isLoading } = useQuery({
    queryKey: ['shifts', from, to, workerId, ''],
    queryFn: () => shiftsApi.listShifts(from, to, workerId),
  })

  const filteredShifts = periodShifts.filter(s => !filterStatus || s.completion_status === filterStatus)
  const periodHrs = Math.round(sumHours(filteredShifts))
  const sortedPeriod = [...filteredShifts].sort(
    (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
  )

  const topClients = Object.values(
    periodShifts
      .filter(s => s.completion_status === 'completed')
      .reduce<Record<string, { name: string; count: number }>>((acc, s) => {
        const id = s.client.id
        if (!acc[id]) acc[id] = { name: `${s.client.first_name} ${s.client.last_name}`, count: 0 }
        acc[id].count++
        return acc
      }, {})
  ).sort((a, b) => b.count - a.count).slice(0, 3)

  return (
    <div className="p-10 space-y-8">

      {/* ── Period toggle + stats ───────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-5">
          {PERIODS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={`px-3.5 py-1.5 font-mono text-[10px] tracking-[0.05em] uppercase transition-colors border ${
                period === key
                  ? 'bg-ink text-cream border-ink'
                  : 'border-ink text-ink-soft hover:text-ink hover:bg-cream-2'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

      </div>

      {/* ── Top clients ─────────────────────────────────────────────── */}
      {topClients.length > 0 && (
        <div className="border border-ink bg-paper">
          <div className="px-6 py-4 border-b border-ink">
            <Kicker>Top clients · completed visits</Kicker>
          </div>
          {topClients.map((c, i) => (
            <div
              key={c.name}
              className={`flex items-center gap-4 px-6 py-3 ${i > 0 ? 'border-t border-dashed border-line-soft' : ''}`}
            >
              <span className="font-mono text-[10px] text-muted w-4">{i + 1}</span>
              <span className="flex-1 text-[13px]">{c.name}</span>
              <span className="font-mono text-[11px] font-bold">{c.count}</span>
              <span className="font-mono text-[10px] text-ink-soft">visits</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Shift history ────────────────────────────────────────────── */}
      <div className="border border-ink bg-paper">
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink gap-4">
          <h2 className="font-serif text-[26px] leading-none tracking-[-0.02em] shrink-0">
            Assigned shifts <span className="italic text-muted">{PERIOD_TITLE[period]}</span>
          </h2>
          <div className="flex items-center gap-3">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-cream border border-ink px-2 py-1 font-mono text-[10px] tracking-[0.05em] uppercase text-ink focus:outline-none"
            >
              <option value="">All statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="no_show">No Show</option>
              <option value="cancelled">Cancelled</option>
              <option value="dropped">Dropped</option>
            </select>
            <span className="font-mono text-[11px] text-ink-soft shrink-0">
              <span className="text-ink font-bold">{periodHrs}</span>h total
            </span>
          </div>
        </div>

        {isLoading ? (
          <p className="px-6 py-8 font-mono text-[10px] text-muted text-center tracking-wide">LOADING…</p>
        ) : sortedPeriod.length === 0 ? (
          <p className="px-6 py-8 font-mono text-[10px] text-muted text-center tracking-wide">NO SHIFTS IN THIS PERIOD</p>
        ) : (
          <div className="px-6 py-5">
            <div className="grid grid-cols-5 gap-6 pb-2 border-b border-ink">
              {['Date', 'Client', 'Time', 'Hours', 'Status'].map(h => (
                <p key={h} className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft">{h}</p>
              ))}
            </div>
            {sortedPeriod.map((shift, i) => {
              const hrs = ((new Date(shift.end_time).getTime() - new Date(shift.start_time).getTime()) / 3_600_000).toFixed(1)
              return (
                <div
                  key={`${shift.shift_id}-${shift.date}`}
                  onClick={() => setSelectedShift(shift)}
                  className={`grid grid-cols-5 gap-6 py-3 cursor-pointer hover:bg-cream-2 transition-colors ${i > 0 ? 'border-t border-dashed border-line-soft' : ''}`}
                >
                  <p className="font-mono text-[11px]">{format(new Date(shift.date), 'MMM d, yyyy')}</p>
                  <p className="text-[12px]">{shift.client.first_name} {shift.client.last_name}</p>
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
