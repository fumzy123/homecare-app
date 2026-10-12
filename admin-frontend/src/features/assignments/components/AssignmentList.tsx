import { SERVICE_TYPE_LABELS } from '@/features/authorizations/constants'
import type { Assignment } from '../api'
import { slotLabel } from '../lib/labels'

// Layer 2: the same controlled assignment cards serve client and worker profiles.
export function AssignmentList({ rows, workerView, onManage }: {
  rows: Assignment[]; workerView: boolean; onManage: (rows: Assignment[]) => void
}) {
  const groups = new Map<string, Assignment[]>()
  for (const row of rows) {
    const key = `${row.placement_id}:${row.worker_id}`
    groups.set(key, [...(groups.get(key) || []), row])
  }
  return <div className="space-y-4">
    {[...groups].map(([key, assignments]) => {
      const first = assignments[0]
      return <article key={key} className="border border-line rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="font-semibold">{workerView ? first.client_name : first.worker_name}</h3>
          {assignments.some(a => a.can_end) && <button className="cw-btn" onClick={() => onManage(assignments)}>Manage assignment</button>}
        </div>
        <ul className="space-y-3">
          {assignments.map(a => <li key={a.id}>
            <div className="flex flex-wrap justify-between gap-2">
              <span>{slotLabel(a)} · {SERVICE_TYPE_LABELS[a.service_type]}</span>
              <span className="cw-badge">{a.status === 'ended' ? 'Ended' : a.status === 'ending' ? 'Ending' : a.status === 'scheduled' ? 'Upcoming' : 'Active'}</span>
            </div>
            <p className="text-sm text-ink-soft mt-1">From {a.starts_on}
              {a.stops_from ? ` · Visits stop from ${a.stops_from}` : a.revision_ends_on ? ` · Revision ends ${a.revision_ends_on}` : ' · Ongoing'}</p>
            {a.end_reason && <p className="text-sm text-ink-soft mt-1">Reason: {a.end_reason}</p>}
          </li>)}
        </ul>
      </article>
    })}
  </div>
}
