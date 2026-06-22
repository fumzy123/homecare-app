import { useQuery } from '@tanstack/react-query'
import { format, startOfWeek, endOfWeek } from 'date-fns'
import { shiftsApi, type ShiftOccurrence } from '@/features/shifts/api'
import { orgMembersApi } from '@/features/org-members/api'
import { WEEK_STARTS_ON } from '@/shared/lib/date'
import { type Period, getDateRange } from '@/features/shifts/utils/period'

interface WorkerOvertimeSectionProps {
  workerId: string
  period: Period
}

interface OvertimeWeek {
  start: Date
  end: Date
  hours: number
  occs: { key: string; date: string; client: string; hours: number }[]
}

function occHours(s: ShiftOccurrence): number {
  return (new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 3_600_000
}

/**
 * Overtime is a per-worker, per-week fact: weeks whose scheduled hours exceed the
 * worker's weekly cap. Computed client-side from the same occurrence data the
 * rest of the worker overview uses.
 */
export function WorkerOvertimeSection({ workerId, period }: WorkerOvertimeSectionProps) {
  const { from, to } = getDateRange(period)

  const { data: shifts = [] } = useQuery({
    queryKey: ['shifts', from, to, workerId, ''],
    queryFn: () => shiftsApi.listShifts(from, to, workerId),
  })
  const { data: worker } = useQuery({
    queryKey: ['worker', workerId],
    queryFn: () => orgMembersApi.getOrgMember(workerId),
  })

  const cap = worker?.max_hours_per_week ?? null

  const weeks = new Map<string, OvertimeWeek>()
  for (const s of shifts) {
    const start = new Date(s.start_time)
    const ws = startOfWeek(start, { weekStartsOn: WEEK_STARTS_ON })
    const key = format(ws, 'yyyy-MM-dd')
    const w = weeks.get(key) ?? { start: ws, end: endOfWeek(start, { weekStartsOn: WEEK_STARTS_ON }), hours: 0, occs: [] }
    w.hours += occHours(s)
    w.occs.push({
      key: `${s.shift_id}-${s.date}`,
      date: s.date,
      client: `${s.client.first_name} ${s.client.last_name}`,
      hours: Math.round(occHours(s) * 10) / 10,
    })
    weeks.set(key, w)
  }

  const overtimeWeeks = cap
    ? [...weeks.values()].filter((w) => w.hours > cap).sort((a, b) => b.start.getTime() - a.start.getTime())
    : []
  const totalOvertime = cap ? Math.round(overtimeWeeks.reduce((sum, w) => sum + (w.hours - cap), 0) * 10) / 10 : 0

  return (
    <div className="border border-ink bg-paper">
      <div className="flex items-center justify-between px-6 py-4 border-b border-ink">
        <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft">Overtime · weeks over cap</p>
        {cap != null && (
          <span className="font-mono text-[11px] text-ink-soft">
            <span className={`font-bold ${totalOvertime > 0 ? 'text-orange' : 'text-ink'}`}>{totalOvertime}</span>h over · {cap}h/wk cap
          </span>
        )}
      </div>

      {cap == null ? (
        <p className="px-6 py-8 font-mono text-[10px] text-muted text-center tracking-wide">NO WEEKLY CAP SET FOR THIS WORKER</p>
      ) : overtimeWeeks.length === 0 ? (
        <p className="px-6 py-8 font-mono text-[10px] text-muted text-center tracking-wide">NO OVERTIME IN THIS PERIOD</p>
      ) : (
        overtimeWeeks.map((w, i) => (
          <div key={w.start.toISOString()} className={i ? 'border-t border-ink' : ''}>
            <div className="flex items-center justify-between px-6 py-3 bg-cream-2">
              <span className="font-mono text-[11px]">
                {format(w.start, 'MMM d')} – {format(w.end, 'MMM d, yyyy')}
              </span>
              <span className="font-mono text-[11px]">
                <span className="font-bold">{Math.round(w.hours * 10) / 10}h</span>
                <span className="text-orange"> · +{Math.round((w.hours - cap) * 10) / 10}h over</span>
              </span>
            </div>
            {w.occs
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((o) => (
                <div key={o.key} className="grid grid-cols-[auto_1fr_auto] gap-4 items-center px-6 py-2 border-t border-dashed border-line-soft">
                  <span className="font-mono text-[10px] text-ink-soft">{format(new Date(o.date), 'EEE MMM d')}</span>
                  <span className="text-[12px]">{o.client}</span>
                  <span className="font-mono text-[11px]">{o.hours}h</span>
                </div>
              ))}
          </div>
        ))
      )}
    </div>
  )
}
