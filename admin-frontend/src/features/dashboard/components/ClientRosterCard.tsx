import { Card, Kicker, Avatar } from '@/shared/components/ui'
import type { Client } from '@/features/clients/api'
import type { ShiftOccurrence } from '@/features/shifts/api'

interface ClientRosterCardProps {
  clients: Client[]
  weekShifts: ShiftOccurrence[]
}

export function ClientRosterCard({ clients, weekShifts }: ClientRosterCardProps) {
  const activeClients = clients.filter((c) => c.status === 'active')

  const clientHours = weekShifts.reduce<Record<string, number>>((acc, shift) => {
    if (['cancelled', 'dropped'].includes(shift.completion_status)) return acc
    const hrs = (new Date(shift.end_time).getTime() - new Date(shift.start_time).getTime()) / 3_600_000
    acc[shift.client.id] = (acc[shift.client.id] ?? 0) + hrs
    return acc
  }, {})

  const rosterClients = [...activeClients]
    .sort((a, b) => (clientHours[b.id] ?? 0) - (clientHours[a.id] ?? 0))
    .slice(0, 7)

  return (
    <Card variant="cream" className="p-0">
      <div className="px-6 py-5 border-b border-ink">
        <Kicker className="mb-1">F / Clients by hours</Kicker>
        <h3 className="font-serif text-[24px] leading-none mt-2 tracking-[-0.02em]">Active client roster</h3>
      </div>
      <div>
        {rosterClients.map((c, i) => {
          const age = c.date_of_birth ? new Date().getFullYear() - new Date(c.date_of_birth).getFullYear() : null
          const hrs = Math.round(clientHours[c.id] ?? 0)
          return (
            <div key={c.id} className="flex items-center gap-5 px-6 py-4 border-t border-dashed border-line-soft border-l-2 border-l-transparent hover:border-l-ink transition-colors">
              <span className="font-mono text-[10px] text-muted w-6 shrink-0">{String(i + 1).padStart(2, '0')}</span>
              <Avatar initials={`${c.first_name[0]}${c.last_name[0]}`} color={(['c1','c2','c3','c4','c5','c6'] as const)[i % 6]} />
              <div className="min-w-0" style={{ width: 180 }}>
                <p className="text-[13px] font-medium">{c.first_name} {c.last_name}</p>
                <p className="font-mono text-[10px] text-ink-soft">{age ? `age ${age}` : '—'}</p>
              </div>
              <p className="flex-1 font-mono text-[11px] text-ink-soft leading-snug">{c.medical_conditions ?? '—'}</p>
              <span className="font-mono text-[13px] font-bold shrink-0">{hrs}h/wk</span>
            </div>
          )
        })}
        {activeClients.length === 0 && (
          <p className="px-6 py-8 font-mono text-[11px] text-muted text-center tracking-wide">NO ACTIVE CLIENTS</p>
        )}
      </div>
    </Card>
  )
}
