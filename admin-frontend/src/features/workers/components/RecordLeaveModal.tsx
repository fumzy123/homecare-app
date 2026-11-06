import { MAX_INPUT_DATE } from '@/shared/lib/date'
import { useState } from 'react'
import { useReviewWorkerLeave } from '../hooks/useWorkerProfile'
import type { LeaveReview } from '@/features/leave/api'
import { useUnsavedChanges } from '@/features/attention/hooks/useUnsavedChanges'
import {
  LEAVE_TYPE_LABELS,
  type LeaveType,
  type LeaveRecordCreatePayload,
} from '@/features/leave/api'
import { WorkerDialog } from './WorkerProfileUI'

export function RecordLeaveModal({
  workerId,
  onClose,
  onSubmit,
  isPending,
  error,
}: {
  workerId: string
  onClose: () => void
  onSubmit: (payload: LeaveRecordCreatePayload) => void
  isPending: boolean
  error: string | null
}) {
  const [type, setType] = useState<LeaveType>('sick'),
    [start, setStart] = useState(''),
    [end, setEnd] = useState(''),
    [notes, setNotes] = useState('')
  const reviewMutation = useReviewWorkerLeave(workerId)
  const [review, setReview] = useState<(LeaveReview & { key: string }) | null>(null)
  const key = JSON.stringify([type, start, end, notes])
  const reviewed = review?.key === key ? review : null
  const busy = isPending || reviewMutation.isPending
  const dirty = !!(start || end || notes || type !== 'sick')
  useUnsavedChanges(dirty || isPending)
  const close = () => {
    if (!busy && (!dirty || window.confirm('Discard this leave record?')))
      onClose()
  }
  return (
    <WorkerDialog
      title="Record leave"
      subtitle="Time away"
      busy={busy}
      onClose={close}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (busy || !start || end < start) return
          const payload = { leave_type: type, start_date: start, end_date: end, notes: notes.trim() || undefined }
          if (reviewed) onSubmit({ ...payload, review_token: reviewed.review_token })
          else reviewMutation.mutate(payload, { onSuccess: data => setReview({ ...data, key }) })
        }}
      >
        <fieldset disabled={busy}>
          <div className="wp-form-grid">
            <label className="wp-field wp-full">
              Leave type
              <select
                className="wp-input"
                value={type}
                onChange={(e) => setType(e.target.value as LeaveType)}
              >
                {Object.entries(LEAVE_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="wp-field">
              First day
              <input
                className="wp-input"
                type="date" max={MAX_INPUT_DATE}
                required
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label className="wp-field">
              Last day
              <input
                className="wp-input"
                type="date" max={MAX_INPUT_DATE}
                required
                min={start}
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
            <label className="wp-field wp-full">
              Notes (optional)
              <textarea
                className="wp-input"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
          </div>
          <p className="wp-notice">
            Recording leave marks affected future shifts as dropped and alerts the agency to arrange cover.
            Recurring assignments remain unchanged. Removing leave does not automatically restore shifts or undo replacements.
          </p>
          {reviewed && <section className="wp-notice" aria-label="Affected shifts">
            <strong>{reviewed.visits.length} shifts need replacement coverage</strong>
            <ul>{reviewed.visits.map(v => <li key={`${v.shift_id}:${v.occurrence_date}`}>
              {v.client} · {v.start_time.slice(0, 10)} · {v.start_time.slice(11, 16)}–{v.end_time.slice(11, 16)}
            </li>)}</ul>
            {reviewed.protected_count > 0 && <p>{reviewed.protected_count} elapsed, ongoing or documented shifts will retain their history.</p>}
          </section>}
          {reviewMutation.isError && <p role="alert" className="wp-error">Could not review affected shifts. Try again.</p>}
          {reviewed && <button type="button" className="wp-btn" onClick={() => setReview(null)}>Review again</button>}
          {error && (
            <p role="alert" className="wp-error">
              {error}
            </p>
          )}
          <div className="wp-actions">
            <button type="button" className="wp-btn" onClick={close}>
              Cancel
            </button>
            <button
              className="wp-btn wp-primary"
              type="submit"
              disabled={busy || !start || !end || end < start}
            >
              {busy ? 'Please wait…' : reviewed ? `Record leave${reviewed.visits.length ? ` and mark ${reviewed.visits.length} shifts needing cover` : ''}` : "Review affected shifts"}
            </button>
          </div>
        </fieldset>
      </form>
    </WorkerDialog>
  )
}
