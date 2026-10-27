import { addDays, format, parseISO } from 'date-fns'
import type { ShiftOccurrence } from '../api'
import { buildWorkerRows, visitTimeLabel } from '../lib/workerSchedule'
import { getStatusToken } from '@/shared/lib/shiftStatus'

// Layer 2: the schedule coordinator supplies roster, visits and selection.
export function WorkersSchedule({ rows, from, clientFiltered, onSelect }: {
  rows: ReturnType<typeof buildWorkerRows>
  from: string
  clientFiltered: boolean
  onSelect: (visit: ShiftOccurrence) => void
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(parseISO(from), i))
  return (
    <table className="workers-schedule" aria-label="Weekly worker schedule">
      <colgroup><col className="workers-schedule-person-column" />{days.map(day => <col key={day.toISOString()} />)}</colgroup>
      <thead><tr>
        <th scope="col" className="workers-schedule-person">Worker<small>{clientFiltered ? 'Hours for selected client' : 'Hours this week'}</small></th>
        {days.map(day => <th scope="col" key={day.toISOString()}>{format(day, 'EEE')}<small>{format(day, 'MMM d')}</small></th>)}
      </tr></thead>
      <tbody>
        {rows.map(({ worker, hours, days: visitsByDay }) => <tr key={worker.id}>
          <th scope="row" className="workers-schedule-person">
            <span className="workers-schedule-name">{worker.first_name} {worker.last_name}</span>
            <small>{Number(hours.toFixed(2))}h scheduled</small>
          </th>
          {visitsByDay.map((visits, day) => <td key={day}>
            {visits.length ? visits.map(visit => {
              const status = getStatusToken(visit.completion_status)
              const name = `${visit.client.first_name} ${visit.client.last_name}`
              const time = visitTimeLabel(visit)
              return <button type="button" key={`${visit.shift_id}:${visit.date}`} className="workers-schedule-visit"
                style={{ background: status.bg, color: status.color, borderColor: status.border, borderStyle: status.dashed ? 'dashed' : 'solid' }}
                aria-label={`${worker.first_name} ${worker.last_name}, ${format(days[day], 'EEEE MMMM d')}, ${time}, ${name}, ${status.label}`}
                onClick={() => onSelect(visit)}>
                <span className="workers-schedule-time">{time}</span>
                <span className="workers-schedule-client">{name}</span>
                <small>{status.label}</small>
              </button>
            }) : <span className="workers-schedule-empty" aria-label="No visits">—</span>}
          </td>)}
        </tr>)}
        {!rows.length && <tr><td colSpan={8} className="workers-schedule-no-results">No workers match this selection.</td></tr>}
      </tbody>
    </table>
  )
}
