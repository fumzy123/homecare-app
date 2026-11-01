import type { Assignment } from '../api'

// Layer 2: retained approval provenance, shared by current coverage and history.
export function AssignmentApproval({ assignment }: { assignment: Assignment }) {
  if (assignment.assignment_source !== 'admin_arranged') return null
  return <p className="text-sm text-ink-soft mt-1">
    <strong>Admin approved</strong>
    {assignment.approved_by_name && <> · {assignment.approved_by_name}</>}
    {assignment.approved_at && <> · <time dateTime={assignment.approved_at}>
      {new Date(assignment.approved_at).toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
      })}
    </time></>}
  </p>
}
