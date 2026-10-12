import { Link } from '@tanstack/react-router'
import { endOfWeek, format, startOfWeek } from 'date-fns'
import type { Client } from '@/features/clients/api'
import type { ShiftOccurrence } from '@/features/shifts/api'
import { WEEK_STARTS_ON } from '@/shared/lib/date'

const INCLUDED_STATUSES = new Set(['scheduled', 'in_progress', 'completed', 'no_show'])

interface WeeklySchedulingGapsProps {
  clients: Client[]
  weekShifts: ShiftOccurrence[]
  isLoading: boolean
  isError: boolean
  embedded?: boolean
}

// Layer 2: presents the supplied roster and weekly schedule, without fetching.
export function WeeklySchedulingGaps({ clients, weekShifts, isLoading, isError, embedded = false }: WeeklySchedulingGapsProps) {
  const today = new Date()
  const from = format(startOfWeek(today, { weekStartsOn: WEEK_STARTS_ON }), 'MMM d')
  const to = format(endOfWeek(today, { weekStartsOn: WEEK_STARTS_ON }), 'MMM d')
  const scheduledClientIds = new Set(weekShifts
    .filter((shift) => INCLUDED_STATUSES.has(shift.completion_status))
    .map((shift) => shift.client.id))
  const unscheduled = clients.filter((client) => client.status === 'active' && !scheduledClientIds.has(client.id))
    .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`))

  const statusClass = embedded ? 'border-t border-line-soft px-6 py-5 text-[12px] text-ink-soft' : 'mt-3 text-[12px] text-ink-soft'
  if (isError) return <p role="status" className={statusClass}>Could not check this week's client schedule.</p>
  if (isLoading) return <p role="status" className={statusClass}>Checking this week's client schedule…</p>
  if (unscheduled.length === 0) return null

  return (
    <details className={embedded ? 'border-t border-line-soft bg-paper' : 'mt-3 border border-ink bg-paper'}>
      <summary className="cursor-pointer px-5 py-4 font-mono text-[11px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
        <span className="ml-2">{unscheduled.length} active {unscheduled.length === 1 ? 'client without visits' : 'clients without visits'} scheduled this week</span>
        <span className="text-ink-soft ml-2">/ {from} – {to}</span>
      </summary>
      <div className="border-t border-line-soft px-5 py-4">
        <p className="text-[12px] text-ink-soft mb-3">Review their care needs; some clients may not need weekly visits. Cancelled and dropped visits are excluded.</p>
        <ul className={embedded ? 'grid gap-2' : 'grid gap-2 sm:grid-cols-2 lg:grid-cols-3'}>
          {unscheduled.map((client) => (
            <li key={client.id}>
              <Link to="/dashboard/clients/$clientId/care-need" params={{ clientId: client.id }} className="text-[12px] underline underline-offset-4 hover:text-orange">
                {client.first_name} {client.last_name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </details>
  )
}
