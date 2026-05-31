import { Card, Kicker, Avatar, ProgressBar } from '@/shared/components/ui'
import type { OrgMember } from '@/features/org-members/api'
import type { ShiftOccurrence } from '@/features/shifts/api'

const TARGET_HOURS = 40

interface WorkerUtilizationCardProps {
  workers: OrgMember[]
  weekShifts: ShiftOccurrence[]
}

export function WorkerUtilizationCard({ workers, weekShifts }: WorkerUtilizationCardProps) {
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
