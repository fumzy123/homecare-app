import { format, startOfWeek, endOfWeek } from 'date-fns'
import { WEEK_STARTS_ON } from '@/shared/lib/date'
import { StatCard } from '@/shared/components/ui'
import type { Client } from '@/features/clients/api'
import type { OrgMember } from '@/features/org-members/api'
import type { ShiftOccurrence } from '@/features/shifts/api'

const weekStartDisplay = format(startOfWeek(new Date(), { weekStartsOn: WEEK_STARTS_ON }), 'MMM d')
const weekEndDisplay   = format(endOfWeek(new Date(),   { weekStartsOn: WEEK_STARTS_ON }), 'MMM d')

interface DashboardStatsStripProps {
  clients: Client[]
  workers: OrgMember[]
  todayShifts: ShiftOccurrence[]
  weekShifts: ShiftOccurrence[]
  droppedShifts: ShiftOccurrence[]
}

export function DashboardStatsStrip({ clients, workers, todayShifts, weekShifts, droppedShifts }: DashboardStatsStripProps) {
  const activeClients = clients.filter((c) => c.status === 'active')
  const activeWorkers = workers.filter((w) => w.is_active)
  const onHoldClients = clients.filter((c) => c.status === 'on_hold')

  const STATS = [
    { label: 'Active clients',   value: activeClients.length, sub: onHoldClients.length > 0 ? `${onHoldClients.length} on hold` : 'all active',    accent: false },
    { label: 'Active workers',   value: activeWorkers.length, sub: `of ${workers.length} total`,                                                    accent: false },
    { label: 'Shifts today',     value: todayShifts.length,   sub: format(new Date(), 'EEEE, MMM d'),                                               accent: false },
    { label: 'Shifts this week', value: weekShifts.length,    sub: `${weekStartDisplay} – ${weekEndDisplay}`,                                       accent: droppedShifts.length > 0 },
  ]

  return (
    <div className="grid grid-cols-4 max-md:grid-cols-2 border border-ink bg-paper overflow-hidden">
      {STATS.map((s, i) => (
        <StatCard key={i} label={s.label} value={s.value} sub={s.sub}
          valueColor={s.accent ? 'text-orange' : undefined}
          size="lg" sublabelInline className="px-7 max-md:px-4 py-6 border-r border-b border-ink" />
      ))}
    </div>
  )
}
