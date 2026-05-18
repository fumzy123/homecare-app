import { useQuery } from '@tanstack/react-query'
import { format, startOfWeek, endOfWeek } from 'date-fns'
import { WEEK_STARTS_ON } from '@/shared/lib/date'
import { orgMembersApi } from '@/features/org-members/api'
import { shiftsApi } from '@/features/shifts/api'
import { Card, Kicker, Avatar, ProgressBar } from '@/shared/components/ui'

const weekStart = format(startOfWeek(new Date(), { weekStartsOn: WEEK_STARTS_ON }), 'yyyy-MM-dd')
const weekEnd   = format(endOfWeek(new Date(),   { weekStartsOn: WEEK_STARTS_ON }), 'yyyy-MM-dd')
const TARGET_HOURS = 40

export function WorkerUtilizationCard() {
  const { data: workers    = [] } = useQuery({ queryKey: ['workers'],  queryFn: () => orgMembersApi.listByRole('home_support_worker') })
  const { data: weekShifts = [] } = useQuery({ queryKey: ['shifts', weekStart, weekEnd], queryFn: () => shiftsApi.listShifts(weekStart, weekEnd) })

  const activeWorkers = workers.filter((w) => w.is_active)

  const workerHours = weekShifts.reduce<Record<string, number>>((acc, shift) => {
    if (['cancelled', 'dropped'].includes(shift.completion_status)) return acc
    const hrs = (new Date(shift.end_time).getTime() - new Date(shift.start_time).getTime()) / 3_600_000
    acc[shift.worker.id] = (acc[shift.worker.id] ?? 0) + hrs
    return acc
  }, {})

  return (
    <Card className="p-6">
      <Kicker className="mb-1">C / Utilization</Kicker>
      <h3 className="font-serif text-[22px] leading-none mt-2 mb-4">
        Worker hours <span className="italic text-muted">— this week</span>
      </h3>
      <div className="space-y-4">
        {activeWorkers.slice(0, 5).map((w, i) => {
          const hrs = Math.round(workerHours[w.id] ?? 0)
          return (
            <div key={w.id} className="px-2 py-2 -mx-2 rounded-sm hover:bg-cream-2 transition-colors">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <Avatar initials={`${w.first_name[0]}${w.last_name[0]}`} color={(['c1','c2','c3','c4','c5'] as const)[i % 5]} size="sm" />
                  <span className="text-[12px] font-medium">{w.first_name} {w.last_name}</span>
                </div>
                <span className="font-mono text-[11px] text-ink-soft">
                  <span className="font-bold text-ink">{hrs}</span>/{TARGET_HOURS}h
                </span>
              </div>
              <ProgressBar value={hrs} max={TARGET_HOURS} variant="mint" />
            </div>
          )
        })}
        {activeWorkers.length === 0 && (
          <p className="font-mono text-[10px] text-muted tracking-wide">NO ACTIVE WORKERS</p>
        )}
      </div>
    </Card>
  )
}
