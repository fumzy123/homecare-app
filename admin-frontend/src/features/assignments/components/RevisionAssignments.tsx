import type { WeeklyCareNeed } from '@/features/weekly-care-need/api'
import { slotHours } from '@/features/clients/lib/care'
import { fmtHours } from '@/features/weekly-care-need/utils'
import type { Assignment } from '../api'
import { assignmentDate, assignmentEnd, revisionAssignments } from '../lib/revisionAssignments'
import { slotLabel } from '../lib/labels'
import '../assigned-workers.css'

const days = { MO: 'Monday', TU: 'Tuesday', WE: 'Wednesday', TH: 'Thursday', FR: 'Friday', SA: 'Saturday', SU: 'Sunday' }

// Layer 2: controlled revision/slot presentation; the panel owns queries and writes.
export function RevisionAssignments({ revision, revisions, rows, today, onManage }: {
  revision: WeeklyCareNeed; revisions: WeeklyCareNeed[]; rows: Assignment[]; today: string
  onManage: (rows: Assignment[]) => void
}) {
  const view = revisionAssignments(revision, rows, today, revisions)
  const changes = view.slots.flatMap(({ slot, visible, history }) => visible.filter(row => row.starts_on > view.asOf).map(row => {
    const previous = history.filter(other => other.id !== row.id && other.starts_on < row.starts_on
      && assignmentEnd(other, revision) && assignmentEnd(other, revision)! >= other.starts_on
      && assignmentEnd(other, revision)! < row.starts_on).at(-1)
    return { row, previous, day: days[slot.day_of_week] }
  }))
  const period = (row: Assignment) => {
    const end = assignmentEnd(row, revision)
    return end && end < row.starts_on
      ? `Scheduled from ${assignmentDate(row.starts_on)}; ended ${assignmentDate(end)} before starting.`
      : `${assignmentDate(row.starts_on)} – ${end ? assignmentDate(end) : 'Ongoing'}`
  }
  return <div className="assigned-workers">
    <div className="aw-context">
      <span>Revision {revision.version} · {view.replaced ? 'Replaced before starting' : `${view.approved ? '' : 'Requested from '}${assignmentDate(view.starts)}${revision.ends_on ? ` – ${assignmentDate(revision.ends_on)}` : ''}`}</span>
      {!view.replaced && !revision.imported && <span className="cw-badge">{view.approved ? `${view.covered}/${view.slots.length} slots covered` : 'Proposed · Not scheduled'}</span>}
    </div>
    <p className="aw-caption">{view.replaced ? 'This revision never started. Its assignment records remain below.'
      : !view.approved ? 'Saving this revision does not change the workers covering approved care.'
      : revision.imported ? 'Imported schedules may not have linked care-slot assignments. See visit history for those schedules.'
      : `${view.historical ? 'Coverage at revision end' : 'Recurring coverage on'} ${assignmentDate(view.asOf)}${view.asOf > today ? ' · Upcoming approved care' : ''}.`}</p>
    <div className="aw-grid">
      {view.slots.map(({ slot, visible, covered }) => <article key={slot.id} className={`aw-slot ${covered ? 'aw-covered' : ''}`} aria-label={`${days[slot.day_of_week]} ${slot.start_time.slice(0, 5)}–${slot.end_time.slice(0, 5)}`}>
        <h3>{days[slot.day_of_week]}</h3>
        <p className="aw-time">{slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)} · {fmtHours(slotHours(slot))}h</p>
        {!covered && <p className="aw-unassigned">{view.replaced ? 'Never started' : revision.imported ? 'No linked coverage' : view.historical ? 'Unassigned at revision end' : 'Unassigned'}
          {view.approved && !view.replaced && !view.historical && !revision.imported && <small>On {assignmentDate(view.asOf)}</small>}</p>}
        {visible.map(row => <div className="aw-worker" key={row.id}>
          <p className="aw-caption">{row.starts_on > view.asOf ? `Scheduled from ${assignmentDate(row.starts_on)}` : view.historical ? 'Past coverage' : view.asOf > today ? 'Approved coverage' : 'Current worker'}</p>
          <strong>{row.worker_name}</strong>
          <p className="aw-caption">{period(row)}</p>
          {row.can_end && <button className="cw-btn aw-manage" aria-label={`Manage assignment for ${row.worker_name} · ${slotLabel(row)}`}
            onClick={() => onManage(view.assignments.filter(other => other.worker_id === row.worker_id && other.placement_id === row.placement_id && other.can_end))}>Manage assignment</button>}
        </div>)}
      </article>)}
    </div>
    {!view.slots.length && <p className="aw-caption">No care slots in this revision.</p>}
    {changes.length > 0 && <div className="aw-changes" aria-label="Scheduled worker changes">{changes.map(({ row, previous, day }) => <p key={row.id}>
      <strong>{day} · {assignmentDate(row.starts_on)}</strong><br />
      {previous ? `${previous.worker_name} → ${row.worker_name}. Previous coverage ends ${assignmentDate(assignmentEnd(previous, revision)!)}.` : `${row.worker_name} starts coverage.`} Same care slot and hours.
    </p>)}</div>}
    {view.successor && <p className="aw-transition">This revision {view.historical ? 'ended' : 'ends'} {assignmentDate(revision.ends_on!)}. Approved revision {view.successor.version} {view.successor.scheduled_from! > today ? 'starts' : 'started'} {assignmentDate(view.successor.scheduled_from!)}. Select it in Weekly care need history to see its workers.</p>}
    <details className="aw-history">
      <summary>Assignment history for this revision <span>({view.assignments.length})</span></summary>
      {view.assignments.length ? <ol>{[...view.assignments].reverse().map(row => {
        const end = assignmentEnd(row, revision)
        const neverStarted = end && end < row.starts_on
        return <li key={row.id}>
          <p className="aw-caption">{neverStarted ? 'Ended before starting' : row.starts_on > today ? 'Scheduled change' : end && end < today ? 'Past assignment' : 'Approved assignment'}</p>
          <strong>{row.worker_name} · {slotLabel(row)}</strong>
          <p>{period(row)}</p>
          {row.stops_from && !neverStarted && <p>{row.stops_from > today ? 'Scheduled to stop' : 'Visits stopped'} from {assignmentDate(row.stops_from)}.</p>}
          {row.end_reason && <p>Reason: {row.end_reason}</p>}
          {row.assignment_source === 'admin_arranged' && <p>Coverage arranged by admin</p>}
        </li>
      })}</ol> : <p className="aw-caption">No approved assignment history for this revision.</p>}
    </details>
  </div>
}
