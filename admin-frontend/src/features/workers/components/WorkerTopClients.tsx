import { useQuery } from '@tanstack/react-query'
import { shiftsApi } from '@/features/shifts/api'
import { shiftHours } from '@/features/shifts/utils/aggregations'
import { Avatar, Kicker } from '@/shared/components/ui'
import { type Period, getDateRange } from '@/features/shifts/utils/period'

const AVATAR_COLORS = ['c2', 'c3', 'c4', 'c5', 'c6'] as const

interface WorkerTopClientsProps {
  workerId: string
  period: Period
}

export function WorkerTopClients({ workerId, period }: WorkerTopClientsProps) {
  const { from, to } = getDateRange(period)

  const { data: shifts = [] } = useQuery({
    queryKey: ['shifts', from, to, workerId, ''],
    queryFn: () => shiftsApi.listShifts(from, to, workerId),
  })

  const topClients = Object.values(
    shifts
      .filter(s => !['cancelled', 'dropped'].includes(s.completion_status))
      .reduce<Record<string, { name: string; hours: number }>>((acc, s) => {
        const id = s.client.id
        if (!acc[id]) acc[id] = { name: `${s.client.first_name} ${s.client.last_name}`, hours: 0 }
        acc[id].hours += shiftHours(s)
        return acc
      }, {}),
  )
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 5)

  if (topClients.length === 0) return null

  const maxHrs = topClients[0]?.hours ?? 0

  return (
    <div>
      <Kicker leader className="mb-3.5">Top clients</Kicker>
      <div className="border border-ink bg-paper">
        {topClients.map((c, i) => {
          const initials = c.name.split(' ').map(n => n[0]).join('').toUpperCase()
          const color    = AVATAR_COLORS[i % AVATAR_COLORS.length]
          const pct      = maxHrs > 0 ? Math.round((c.hours / maxHrs) * 100) : 0
          const hrs      = Math.round(c.hours * 10) / 10

          return (
            <div key={c.name} className={`px-5 py-3.5 ${i > 0 ? 'border-t border-dashed border-line-soft' : ''}`}>
              <div className="flex items-center gap-3 mb-2.5">
                <Avatar initials={initials} color={color} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium leading-snug truncate">{c.name}</p>
                  <p className="font-mono text-[10px] text-muted">{hrs}h this period</p>
                </div>
              </div>
              <div className="h-1.5 bg-line-faint">
                <div className="h-full bg-mint-dark" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
