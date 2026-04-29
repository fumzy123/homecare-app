import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { format, startOfYear, endOfYear, getMonth } from 'date-fns'
import { shiftsApi, type ShiftOccurrence } from '@/features/shifts/api'
import { StatCard } from '@/shared/components/ui'

export const Route = createFileRoute('/_protected/dashboard/clients/$clientId/care-hours')({
  component: ClientCareHours,
})

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

type MonthHours = { hours: number; visits: number }

function shiftHours(shift: ShiftOccurrence): number {
  return (new Date(shift.end_time).getTime() - new Date(shift.start_time).getTime()) / 3_600_000
}

function buildMonthlyHours(shifts: ShiftOccurrence[]): MonthHours[] {
  const months: MonthHours[] = Array.from({ length: 12 }, () => ({ hours: 0, visits: 0 }))
  for (const shift of shifts) {
    if (['cancelled', 'dropped'].includes(shift.completion_status)) continue
    const m = months[getMonth(new Date(shift.date))]
    m.hours  += shiftHours(shift)
    m.visits += 1
  }
  return months
}

function buildWorkerBreakdown(shifts: ShiftOccurrence[]): { id: string; name: string; hours: number; visits: number }[] {
  const map: Record<string, { id: string; name: string; hours: number; visits: number }> = {}
  for (const shift of shifts) {
    if (['cancelled', 'dropped'].includes(shift.completion_status)) continue
    const id = shift.worker.id
    if (!map[id]) map[id] = { id, name: `${shift.worker.first_name} ${shift.worker.last_name}`, hours: 0, visits: 0 }
    map[id].hours  += shiftHours(shift)
    map[id].visits += 1
  }
  return Object.values(map).sort((a, b) => b.hours - a.hours)
}

function ClientCareHours() {
  const { clientId } = Route.useParams()
  const currentYear  = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const yearOptions  = Array.from({ length: 5 }, (_, i) => currentYear - i)

  const from = format(startOfYear(new Date(year, 0)), 'yyyy-MM-dd')
  const to   = format(endOfYear(new Date(year, 0)),   'yyyy-MM-dd')

  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ['shifts', from, to, '', clientId],
    queryFn:  () => shiftsApi.listShifts(from, to, undefined, clientId),
  })

  const monthly  = buildMonthlyHours(shifts)
  const workers  = buildWorkerBreakdown(shifts)

  const totalHours  = monthly.reduce((s, m) => s + m.hours, 0)
  const totalVisits = monthly.reduce((s, m) => s + m.visits, 0)
  const weeksInYear = year === currentYear ? Math.ceil((new Date().getTime() - new Date(year, 0, 1).getTime()) / (7 * 86_400_000)) : 52
  const avgPerWeek  = weeksInYear > 0 ? totalHours / weeksInYear : 0

  return (
    <div className="p-10 space-y-8">

      {/* ── Year selector ── */}
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

      {/* ── Annual summary ── */}
      <div className="grid grid-cols-3 border border-ink bg-paper">
        <StatCard
          label="Total Hours"
          value={`${totalHours.toFixed(1)}h`}
          sub="care delivered"
          size="lg"
          className="border-r border-ink px-7 py-6"
        />
        <StatCard
          label="Avg per Week"
          value={`${avgPerWeek.toFixed(1)}h`}
          sub="hours / week"
          size="lg"
          className="border-r border-ink px-7 py-6"
        />
        <StatCard
          label="Total Visits"
          value={totalVisits}
          sub="completed visits"
          size="lg"
          className="px-7 py-6"
        />
      </div>

      {/* ── Monthly grid + worker breakdown side by side ── */}
      <div className="grid grid-cols-3 gap-6">

        {/* Monthly grid — 2/3 width */}
        <div className="col-span-2 border border-ink bg-paper">
          <div className="px-6 py-4 border-b border-ink">
            <h2 className="font-serif text-[22px] leading-none tracking-[-0.02em]">
              Hours by month <span className="italic text-muted">{year}</span>
            </h2>
          </div>

          {isLoading ? (
            <p className="px-6 py-8 font-mono text-[10px] text-muted text-center tracking-wide">LOADING…</p>
          ) : (
            <div className="grid grid-cols-3">
              {MONTHS.map((month, i) => {
                const m           = monthly[i]
                const isLastRow   = i >= 9
                const isRightEdge = (i + 1) % 3 === 0
                return (
                  <div
                    key={month}
                    className={`px-5 py-4 hover:bg-cream-2 transition-colors ${!isLastRow ? 'border-b border-ink' : ''} ${!isRightEdge ? 'border-r border-ink' : ''}`}
                  >
                    <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft mb-2">{month}</p>
                    {m.visits === 0 ? (
                      <p className="font-mono text-[10px] text-ink-soft/40">—</p>
                    ) : (
                      <>
                        <p className="font-serif text-[28px] leading-none">{m.hours.toFixed(1)}<span className="font-mono text-[11px] text-ink-soft ml-1">h</span></p>
                        <p className="font-mono text-[9px] text-ink-soft mt-1">{m.visits} {m.visits === 1 ? 'visit' : 'visits'}</p>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Worker breakdown — 1/3 width */}
        <div className="border border-ink bg-paper self-start">
          <div className="px-6 py-4 border-b border-ink">
            <h2 className="font-serif text-[22px] leading-none tracking-[-0.02em]">Workers</h2>
          </div>

          {isLoading ? (
            <p className="px-6 py-8 font-mono text-[10px] text-muted text-center tracking-wide">LOADING…</p>
          ) : workers.length === 0 ? (
            <p className="px-6 py-8 font-mono text-[10px] text-muted text-center tracking-wide">NO DATA</p>
          ) : (
            <div className="divide-y divide-dashed divide-line-soft">
              {workers.map((w, i) => (
                <div key={w.id} className="flex items-center gap-3 px-5 py-3 hover:bg-cream-2 transition-colors">
                  <span className="font-mono text-[10px] text-muted w-4 shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] truncate">{w.name}</p>
                    <p className="font-mono text-[9px] text-ink-soft">{w.visits} {w.visits === 1 ? 'visit' : 'visits'}</p>
                  </div>
                  <span className="font-mono text-[11px] font-bold shrink-0">{w.hours.toFixed(1)}h</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
