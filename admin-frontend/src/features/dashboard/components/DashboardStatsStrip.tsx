import { format, startOfWeek, endOfWeek } from 'date-fns'
import { WEEK_STARTS_ON } from '@/shared/lib/date'
import { StatCard } from '@/shared/components/ui'
import type { Client } from '@/features/clients/api'
import type { OrgMember } from '@/features/org-members/api'
import type { ShiftOccurrence } from '@/features/shifts/api'

interface DashboardStatsStripProps {
  clients: Client[]
  workers: OrgMember[]
  todayShifts: ShiftOccurrence[]
  weekShifts: ShiftOccurrence[]
  droppedShifts: ShiftOccurrence[]
}

export function DashboardStatsStrip({ clients, workers, todayShifts, weekShifts, droppedShifts }: DashboardStatsStripProps) {
  const today = new Date()
  const weekStartDisplay = format(startOfWeek(today, { weekStartsOn: WEEK_STARTS_ON }), 'MMM d')
  const weekEndDisplay = format(endOfWeek(today, { weekStartsOn: WEEK_STARTS_ON }), 'MMM d')
  const activeClients = clients.filter((c) => c.status === 'active')
  const activeWorkers = workers.filter((w) => w.is_active)
  const onHoldClients = clients.filter((c) => c.status === 'on_hold')
  const workersOnLeave = workers.filter((w) => w.employment_status === 'on_leave').length
  const terminatedWorkers = workers.filter((w) => w.employment_status === 'terminated').length
  const standbyWorkers = activeWorkers.filter((w) => w.on_standby).length
  const workerStatusSummary = [
    standbyWorkers > 0 ? `${standbyWorkers} on standby` : '',
    workersOnLeave > 0 ? `${workersOnLeave} on leave` : '',
    terminatedWorkers > 0 ? `${terminatedWorkers} terminated` : '',
  ].filter(Boolean).join(' · ')
  const completed = todayShifts.filter((shift) => shift.completion_status === 'completed').length
  const inProgress = todayShifts.filter((shift) => shift.completion_status === 'in_progress').length

  const STATS = [
    { label: 'Active clients', value: activeClients.length, sub: `${onHoldClients.length} on hold`, accent: false },
    { label: 'Active workers', value: activeWorkers.length, sub: `of ${workers.length} total`, description: workerStatusSummary, accent: false },
    { label: 'Shifts today', value: todayShifts.length, valueNote: `/ ${completed} complete`, sub: `${inProgress} in progress`, accent: false },
    { label: 'Shifts this week', value: weekShifts.length,    sub: `${weekStartDisplay} – ${weekEndDisplay}`,                                       accent: droppedShifts.length > 0 },
  ]

  return (
    <div className="grid grid-cols-4 max-md:grid-cols-2 border border-ink bg-paper overflow-hidden">
      {STATS.map((s) => (
        <StatCard key={s.label} label={s.label} value={s.value} sub={s.sub}
          description={s.description} valueNote={s.valueNote} hoverVariant="mint"
          valueColor={s.accent ? 'text-orange' : undefined}
          size="lg" className="px-7 max-md:px-4 py-6 border-ink max-md:[&:nth-child(-n+2)]:border-b max-md:odd:border-r md:[&:not(:last-child)]:border-r" />
      ))}
    </div>
  )
}
