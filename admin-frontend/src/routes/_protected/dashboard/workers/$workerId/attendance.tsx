import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { format, startOfYear, endOfYear, getMonth } from 'date-fns'
import { shiftsApi, type ShiftOccurrence } from '@/features/shifts/api'

export const Route = createFileRoute('/_protected/dashboard/workers/$workerId/attendance')({
  component: WorkerAttendance,
})

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

type MonthStats = {
  scheduled: number
  completed: number
  no_show: number
  cancelled: number
  dropped: number
  rate: number | null
}

function buildMonthlyStats(shifts: ShiftOccurrence[]): MonthStats[] {
  const months: MonthStats[] = Array.from({ length: 12 }, () => ({
    scheduled: 0, completed: 0, no_show: 0, cancelled: 0, dropped: 0, rate: null,
  }))

  for (const shift of shifts) {
    const month = getMonth(new Date(shift.date))
    const s = months[month]
    s.scheduled++
    const status = shift.completion_status
    if (status === 'completed')  s.completed++
    else if (status === 'no_show')   s.no_show++
    else if (status === 'cancelled') s.cancelled++
    else if (status === 'dropped')   s.dropped++
  }

  for (const s of months) {
    const countable = s.completed + s.no_show
    s.rate = countable > 0 ? Math.round((s.completed / countable) * 100) : null
  }

  return months
}

function rateColor(rate: number | null): string {
  if (rate === null) return 'text-ink-soft'
  if (rate >= 90)   return 'text-green-700'
  if (rate >= 75)   return 'text-amber-600'
  return 'text-orange'
}

function WorkerAttendance() {
  const { workerId } = Route.useParams()
  const currentYear  = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const yearOptions  = Array.from({ length: 5 }, (_, i) => currentYear - i)

  const from = format(startOfYear(new Date(year, 0)), 'yyyy-MM-dd')
  const to   = format(endOfYear(new Date(year, 0)),   'yyyy-MM-dd')

  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ['shifts', from, to, workerId, ''],
    queryFn:  () => shiftsApi.listShifts(from, to, workerId),
  })

  const monthly = buildMonthlyStats(shifts)

  const annual = monthly.reduce(
    (acc, m) => ({
      scheduled: acc.scheduled + m.scheduled,
      completed: acc.completed + m.completed,
      no_show:   acc.no_show   + m.no_show,
      cancelled: acc.cancelled + m.cancelled,
      dropped:   acc.dropped   + m.dropped,
    }),
    { scheduled: 0, completed: 0, no_show: 0, cancelled: 0, dropped: 0 },
  )
  const countable = annual.completed + annual.no_show
  const annualRate = countable > 0 ? Math.round((annual.completed / countable) * 100) : null

  return (
    <div className="p-10 space-y-8">

      {/* ── Year selector ───────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        {yearOptions.map((y) => (
          <button
            key={y}
            onClick={() => setYear(y)}
            className={`px-3.5 py-1.5 font-mono text-[10px] tracking-[0.05em] uppercase transition-colors border ${
              year === y
                ? 'bg-ink text-cream border-ink'
                : 'border-ink text-ink-soft hover:text-ink hover:bg-cream-2'
            }`}
          >
            {y}
          </button>
        ))}
      </div>

      {/* ── Annual summary ──────────────────────────────────────── */}
      <div className="border border-ink bg-paper">
        {/* Row 1 — shift volume */}
        <div className="grid grid-cols-3 border-b border-ink">
          {[
            { label: 'Shifts scheduled', value: annual.scheduled,                              sub: 'on the calendar'  },
            { label: 'Shifts Cancelled ',        value: annual.cancelled + annual.dropped,             sub: 'by admin or client'         },
            { label: 'Shifts Expected',         value: annual.scheduled - (annual.cancelled + annual.dropped), sub: 'to be attended by worker' },
          ].map((s, i) => (
            <div key={s.label} className={`px-6 py-5 hover:bg-cream-2 transition-colors ${i < 2 ? 'border-r border-ink' : ''}`}>
              <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft mb-3">{s.label}</p>
              <p className="font-serif text-[48px] leading-none">{s.value}</p>
              <p className="font-mono text-[10px] text-ink-soft mt-1">{s.sub}</p>
            </div>
          ))}
        </div>
        {/* Row 2 — performance */}
        <div className="grid grid-cols-3">
          {[
            { label: 'Shifts worked',   value: annual.completed,                              sub: 'completed',             color: false },
            { label: 'No-shows',        value: annual.no_show,                                sub: 'missed',                color: false },
            { label: 'Attendance rate', value: annualRate !== null ? `${annualRate}%` : '—',  sub: 'of this year so far',    color: true  },
          ].map((s, i) => (
            <div key={s.label} className={`px-6 py-5 hover:bg-cream-2 transition-colors ${i < 2 ? 'border-r border-ink' : ''}`}>
              <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft mb-3">{s.label}</p>
              <p className={`font-serif text-[48px] leading-none ${s.color ? rateColor(annualRate) : ''}`}>{s.value}</p>
              <p className="font-mono text-[10px] text-ink-soft mt-1">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Monthly grid ────────────────────────────────────────── */}
      <div className="border border-ink bg-paper">
        <div className="px-6 py-4 border-b border-ink">
          <h2 className="font-serif text-[26px] leading-none tracking-[-0.02em]">
            Monthly breakdown <span className="italic text-muted">{year}</span>
          </h2>
        </div>

        {isLoading ? (
          <p className="px-6 py-8 font-mono text-[10px] text-muted text-center tracking-wide">LOADING…</p>
        ) : (
          <div className="grid grid-cols-3">
            {MONTHS.map((month, i) => {
              const s = monthly[i]
              const isLast = i >= 9
              const isRightEdge = (i + 1) % 3 === 0
              return (
                <div
                  key={month}
                  className={`px-6 py-5 ${!isLast ? 'border-b border-ink' : ''} ${!isRightEdge ? 'border-r border-ink' : ''}`}
                >
                  <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft mb-3">{month}</p>

                  {s.scheduled === 0 ? (
                    <p className="font-mono text-[10px] text-ink-soft/50">No shifts</p>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-serif text-[28px] leading-none">{s.completed}</span>
                        <span className="font-mono text-[10px] text-ink-soft">/ {s.completed + s.no_show} shifts</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {s.no_show > 0 && (
                          <span className="font-mono text-[9px] text-orange">
                            {s.no_show} no-show{s.no_show > 1 ? 's' : ''}
                          </span>
                        )}
                        {s.rate !== null && (
                          <span className={`font-mono text-[9px] font-bold ${rateColor(s.rate)}`}>
                            {s.rate}%
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
