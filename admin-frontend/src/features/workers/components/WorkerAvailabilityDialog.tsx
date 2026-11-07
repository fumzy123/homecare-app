import { useConfirmation } from '@/shared/components/confirmation'
import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type {
  AvailabilityEntry,
  AvailabilityEntryInput,
  WeekDay,
} from '@/features/org-members/api'
import { useSaveWorkerAvailability } from '@/features/org-members/hooks/useWorkerAvailability'
import { useUnsavedChanges } from '@/features/attention/hooks/useUnsavedChanges'
import { errorMessage } from '@/features/clients/lib/care'
import { WorkerDialog } from './WorkerProfileUI'
import { WORKER_DAYS } from '../lib/profile'

export function WorkerAvailabilityDialog({
  workerId,
  entries,
  onClose,
}: {
  workerId: string
  entries: AvailabilityEntry[]
  onClose: () => void
}) {
  const confirm = useConfirmation()
  const initial = entries.map((e) => ({
    day_of_week: e.day_of_week,
    start_time: e.start_time.slice(0, 5),
    end_time: e.end_time.slice(0, 5),
  }))
  const [rows, setRows] = useState<AvailabilityEntryInput[]>(initial),
    [error, setError] = useState('')
  const save = useSaveWorkerAvailability(workerId)
  const dirty = JSON.stringify(rows) !== JSON.stringify(initial)
  useUnsavedChanges(dirty, undefined, save.isPending)
  const close = async () => {
    if (
      !save.isPending &&
      (!dirty || await confirm({ title: 'Discard availability changes?' }))
    )
      onClose()
  }
  const update = (index: number, patch: Partial<AvailabilityEntryInput>) =>
    setRows((current) =>
      current.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    )
  return (
    <WorkerDialog
      title="Recurring availability"
      subtitle="Usual available times"
      onClose={close}
      busy={save.isPending}
      wide
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          if (save.isPending) return
          setError('')
          if (rows.some((r) => r.end_time <= r.start_time)) {
            setError('Each window must end after it starts.')
            return
          }
          try {
            await save.mutateAsync(rows)
            onClose()
          } catch (err) {
            setError(errorMessage(err))
          }
        }}
      >
        <fieldset disabled={save.isPending}>
          <p className="wp-muted" style={{ marginBottom: 22 }}>
            Add one or more windows per day. Days without a window have no
            recorded availability.
          </p>
          {rows.length === 0 && (
            <p className="wp-empty">No availability recorded.</p>
          )}
          {rows.map((row, i) => (
            <div className="wp-availability-edit" key={i}>
              <label className="wp-field">
                Day
                <select
                  className="wp-input"
                  value={row.day_of_week}
                  onChange={(e) =>
                    update(i, { day_of_week: e.target.value as WeekDay })
                  }
                >
                  {WORKER_DAYS.map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="wp-field">
                From
                <input
                  className="wp-input"
                  type="time"
                  required
                  value={row.start_time}
                  onChange={(e) => update(i, { start_time: e.target.value })}
                />
              </label>
              <label className="wp-field">
                Until
                <input
                  className="wp-input"
                  type="time"
                  required
                  value={row.end_time}
                  onChange={(e) => update(i, { end_time: e.target.value })}
                />
              </label>
              <button
                type="button"
                className="wp-icon"
                aria-label={`Remove availability window ${i + 1}`}
                onClick={() =>
                  setRows((current) =>
                    current.filter((_, index) => index !== i),
                  )
                }
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="wp-link"
            onClick={() =>
              setRows((current) => [
                ...current,
                { day_of_week: 'MO', start_time: '09:00', end_time: '17:00' },
              ])
            }
          >
            <Plus size={15} />
            Add window
          </button>
          {error && (
            <p role="alert" className="wp-error">
              {error}
            </p>
          )}
          <div className="wp-actions">
            <button type="button" className="wp-btn" onClick={close}>
              Cancel
            </button>
            <button type="submit" className="wp-btn wp-primary">
              {save.isPending ? 'Saving…' : 'Save availability'}
            </button>
          </div>
        </fieldset>
      </form>
    </WorkerDialog>
  )
}
