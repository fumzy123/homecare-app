import { useQuery } from '@tanstack/react-query'
import { format, startOfWeek, endOfWeek } from 'date-fns'
import { WEEK_STARTS_ON } from '@/shared/lib/date'
import { clientsApi } from '@/features/clients/api'
import { workersApi } from '@/features/workers/api'
import { shiftsApi } from '@/features/shifts/api'
import { addDays, subDays } from 'date-fns'
import { StatCard } from '@/shared/components/ui'

const today     = format(new Date(), 'yyyy-MM-dd')
const weekStart = format(startOfWeek(new Date(), { weekStartsOn: WEEK_STARTS_ON }), 'yyyy-MM-dd')
const weekEnd   = format(endOfWeek(new Date(),   { weekStartsOn: WEEK_STARTS_ON }), 'yyyy-MM-dd')
const weekStartDisplay = format(startOfWeek(new Date(), { weekStartsOn: WEEK_STARTS_ON }), 'MMM d')
const weekEndDisplay   = format(endOfWeek(new Date(),   { weekStartsOn: WEEK_STARTS_ON }), 'MMM d')
const droppedFrom = format(subDays(new Date(), 7),  'yyyy-MM-dd')
const droppedTo   = format(addDays(new Date(), 60), 'yyyy-MM-dd')

export function DashboardStatsStrip() {
  const { data: clients     = [] } = useQuery({ queryKey: ['clients'],  queryFn: () => clientsApi.listClients() })
  const { data: workers     = [] } = useQuery({ queryKey: ['workers'],  queryFn: workersApi.listWorkers })
  const { data: todayShifts = [] } = useQuery({ queryKey: ['shifts', today, today], queryFn: () => shiftsApi.listShifts(today, today) })
  const { data: weekShifts  = [] } = useQuery({ queryKey: ['shifts', weekStart, weekEnd], queryFn: () => shiftsApi.listShifts(weekStart, weekEnd) })
  const { data: droppedShifts = [] } = useQuery({ queryKey: ['shifts', droppedFrom, droppedTo, 'dropped'], queryFn: () => shiftsApi.listShifts(droppedFrom, droppedTo, undefined, undefined, ['dropped']) })

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
