import { useState } from 'react'
import { useUnsavedChanges } from '@/features/attention/hooks/useUnsavedChanges'
import {
  LEAVE_TYPE_LABELS,
  type LeaveType,
  type LeaveRecordCreatePayload,
} from '@/features/leave/api'
import { WorkerDialog } from './WorkerProfileUI'

export function RecordLeaveModal({
  onClose,
  onSubmit,
  isPending,
  error,
}: {
  onClose: () => void
  onSubmit: (payload: LeaveRecordCreatePayload) => void
  isPending: boolean
  error: string | null
}) {
  const [type, setType] = useState<LeaveType>('sick'),
    [start, setStart] = useState(''),
    [end, setEnd] = useState(''),
    [notes, setNotes] = useState('')
  const dirty = !!(start || end || notes || type !== 'sick')
  useUnsavedChanges(dirty || isPending)
  const close = () => {
    if (!isPending && (!dirty || window.confirm('Discard this leave record?')))
      onClose()
  }
  return (
    <WorkerDialog
      title="Record leave"
      subtitle="Time away"
      busy={isPending}
      onClose={close}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!isPending && start && end >= start)
            onSubmit({
              leave_type: type,
              start_date: start,
              end_date: end,
              notes: notes.trim() || undefined,
            })
        }}
      >
        <fieldset disabled={isPending}>
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
                type="date"
                required
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label className="wp-field">
              Last day
              <input
                className="wp-input"
                type="date"
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
            Recording leave does not cancel or reassign visits. Review the
            worker’s schedule to arrange coverage.
          </p>
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
              disabled={!start || !end || end < start}
            >
              {isPending ? 'Saving…' : 'Save record'}
            </button>
          </div>
        </fieldset>
      </form>
    </WorkerDialog>
  )
}
