import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, startOfYear, endOfYear, getMonth } from 'date-fns'
import { shiftsApi, type ShiftOccurrence } from '@/features/shifts/api'
import { shiftHours } from '@/features/shifts/utils/aggregations'
import { StatCard, YearSelector } from '@/shared/components/ui'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

type MonthHours = { hours: number; visits: number }

function buildMonthlyHours(shifts: ShiftOccurrence[]): MonthHours[] {
  const months: MonthHours[] = Array.from({ length: 12 }, () => ({ hours: 0, visits: 0 }))
  for (const shift of shifts) {
    if (shift.completion_status !== 'completed') continue
    const m = months[getMonth(new Date(shift.date))]
    m.hours  += shiftHours(shift)
    m.visits += 1
  }
  return months
}

function buildWorkerBreakdown(shifts: ShiftOccurrence[]) {
  const map: Record<string, { id: string; name: string; hours: number; visits: number }> = {}
  for (const shift of shifts) {
    if (shift.completion_status !== 'completed') continue
    const id = shift.worker.id
    if (!map[id]) map[id] = { id, name: `${shift.worker.first_name} ${shift.worker.last_name}`, hours: 0, visits: 0 }
    map[id].hours  += shiftHours(shift)
    map[id].visits += 1
  }
  return Object.values(map).sort((a, b) => b.hours - a.hours)
}

export function ClientCareHoursReport({ clientId }: { clientId: string }) {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)

  const from = format(startOfYear(new Date(year, 0)), 'yyyy-MM-dd')
  const to   = format(endOfYear(new Date(year, 0)),   'yyyy-MM-dd')

  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ['shifts', from, to, '', clientId],
    queryFn:  () => shiftsApi.listShifts(from, to, undefined, clientId),
  })

  const monthly        = buildMonthlyHours(shifts)
  const workers        = buildWorkerBreakdown(shifts)
  const totalHours     = shifts.filter(s => !['cancelled', 'dropped'].includes(s.completion_status)).reduce((sum, s) => sum + shiftHours(s), 0)
  const totalVisits    = monthly.reduce((s, m) => s + m.visits, 0)
  const deliveredHours = shifts.filter(s => s.completion_status === 'completed').reduce((sum, s) => sum + shiftHours(s), 0)
  const weeksInYear    = year === currentYear ? Math.ceil((new Date().getTime() - new Date(year, 0, 1).getTime()) / (7 * 86_400_000)) : 52
  const avgPerWeek     = weeksInYear > 0 ? totalHours / weeksInYear : 0

  return (
    <div className="space-y-8">
      <YearSelector year={year} onChange={setYear} />

      {/* Annual summary */}
      <div className="grid grid-cols-4 border border-ink bg-paper">
        <StatCard label="Total Hours Expected" value={`${totalHours.toFixed(1)}h`} sub="scheduled + completed" size="md" className="border-r border-ink px-7 py-6" />
        <StatCard label="Total Hours Delivered" value={`${deliveredHours.toFixed(1)}h`} sub="care delivered" size="md" className="border-r border-ink px-7 py-6" />
        <StatCard label="Avg per Week" value={`${avgPerWeek.toFixed(1)}h`} sub="hours / week" size="md" className="border-r border-ink px-7 py-6" />
        <StatCard label="Total Visits" value={totalVisits} sub="completed visits" size="md" className="px-7 py-6" />
      </div>

      {/* Monthly grid + worker breakdown */}
      <div className="grid grid-cols-3 gap-6">
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
                  <div key={month} className={`px-5 py-4 hover:bg-cream-2 transition-colors ${!isLastRow ? 'border-b border-ink' : ''} ${!isRightEdge ? 'border-r border-ink' : ''}`}>
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
