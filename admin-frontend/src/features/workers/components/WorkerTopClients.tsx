import { useQuery } from '@tanstack/react-query'
import { shiftsApi } from '@/features/shifts/api'
import { type Period, getDateRange } from '@/features/shifts/utils/period'

interface WorkerTopClientsProps {
  workerId: string
  period: Period
}

export function WorkerTopClients({ workerId, period }: WorkerTopClientsProps) {
  const { from, to } = getDateRange(period)

  const { data: shifts = [] } = useQuery({
    queryKey: ['shifts', from, to, workerId, ''],
    queryFn:  () => shiftsApi.listShifts(from, to, workerId),
  })

  const topClients = Object.values(
    shifts
      .filter(s => s.completion_status === 'completed')
      .reduce<Record<string, { name: string; count: number }>>((acc, s) => {
        const id = s.client.id
        if (!acc[id]) acc[id] = { name: `${s.client.first_name} ${s.client.last_name}`, count: 0 }
        acc[id].count++
        return acc
      }, {})
  ).sort((a, b) => b.count - a.count).slice(0, 3)

  if (topClients.length === 0) return null

  return (
    <div className="border border-ink bg-paper">
      <div className="px-6 py-4 border-b border-ink">
        <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft">Top clients · completed visits</p>
      </div>
      {topClients.map((c, i) => (
        <div key={c.name} className={`flex items-center gap-4 px-6 py-3 ${i > 0 ? 'border-t border-dashed border-line-soft' : ''}`}>
          <span className="font-mono text-[10px] text-muted w-4">{i + 1}</span>
          <span className="flex-1 text-[13px]">{c.name}</span>
          <span className="font-mono text-[11px] font-bold">{c.count}</span>
          <span className="font-mono text-[10px] text-ink-soft">visits</span>
        </div>
      ))}
    </div>
  )
}
