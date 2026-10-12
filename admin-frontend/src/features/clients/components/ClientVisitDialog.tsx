import { useEffect, useState } from 'react'
import { useUnsavedChanges } from '@/features/attention/hooks/useUnsavedChanges'
import { format, parseISO } from 'date-fns'
import { Pencil, Plus } from 'lucide-react'
import type { ShiftOccurrence } from '@/features/shifts/api'
import { ShiftDetailDrawer } from '@/features/shifts/components/ShiftDetailDrawer'
import { ShiftStatusBadge } from '@/shared/components/ui'
import { useVisitNote, useAppendVisitNote } from '../hooks/useVisitNotes'
import { serviceName, visitHours, errorMessage } from '../lib/care'
import { fmtHours } from '@/features/authorizations/utils'
import { ClientDialog, ClientLoading } from './ClientWorkspaceUI'

export function VisitNotes({
  shiftId,
  date,
  onDirtyChange,
}: {
  shiftId: string
  date: string
  onDirtyChange?: (dirty: boolean) => void
}) {
  const note = useVisitNote(shiftId, date)
  const append = useAppendVisitNote(shiftId, date)
  const [adding, setAdding] = useState(false)
  const [content, setContent] = useState('')
  const [time, setTime] = useState(format(new Date(), 'HH:mm'))
  const [kind, setKind] = useState('Follow-up')
  const dirty = adding && !!content.trim()
  useUnsavedChanges(dirty && !append.isPending)
  useEffect(() => {
    onDirtyChange?.(dirty || append.isPending)
  }, [dirty, append.isPending, onDirtyChange])
  if (note.isPending || note.isError)
    return (
      <ClientLoading error={note.isError} retry={() => void note.refetch()} />
    )
  return (
    <section>
      <div className="cw-between">
        <h3>Progress notes</h3>
        {!adding && (
          <button className="cw-link" onClick={() => setAdding(true)}>
            <Plus size={14} />
            {note.data?.entries.length ? 'Add follow-up' : 'Add note'}
          </button>
        )}
      </div>
      {!note.data?.entries.length && !adding && (
        <p className="cw-muted mt-5">
          No progress notes recorded for this visit.
        </p>
      )}
      {note.data?.entries.map((entry, i) => (
        <div key={i} className="cw-note-entry">
          <p className="cw-label mb-2">{entry.time}</p>
          <p>{entry.content}</p>
        </div>
      ))}
      {adding && (
        <form
          className="cw-stack mt-5"
          onSubmit={async (e) => {
            e.preventDefault()
            try {
              await append.mutateAsync({
                time,
                content: note.data?.entries.length
                  ? `${kind}: ${content.trim()}`
                  : content.trim(),
                expected_entry_count: note.data?.entries.length || 0,
              })
              setContent('')
              setAdding(false)
            } catch {
              /* Mutation error is shown below. */
            }
          }}
        >
          <div className="cw-form-grid">
            <label className="cw-field">
              Entry type
              <select
                className="cw-input"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                <option>Follow-up</option>
                <option>Correction</option>
              </select>
            </label>
            <label className="cw-field">
              Time
              <input
                type="time"
                className="cw-input"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
              />
            </label>
          </div>
          <label className="cw-field">
            Note
            <textarea
              className="cw-input"
              rows={5}
              maxLength={9980}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
            />
          </label>
          <p className="cw-muted">
            Added as a new entry; previous notes stay unchanged.
          </p>
          {append.isError && (
            <p role="alert" className="cw-error">
              {errorMessage(append.error)}
            </p>
          )}
          <div className="cw-row">
            <button
              type="submit"
              className="cw-btn cw-btn-primary"
              disabled={append.isPending || !content.trim()}
            >
              {append.isPending ? 'Saving…' : 'Save entry'}
            </button>
            <button
              type="button"
              className="cw-btn"
              disabled={append.isPending}
              onClick={() => {
                if (dirty && !window.confirm('Discard this unsaved note?'))
                  return
                setContent('')
                setAdding(false)
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
export function ClientVisitDialog({
  visit,
  onClose,
}: {
  visit: ShiftOccurrence
  onClose: () => void
}) {
  const [manage, setManage] = useState(false)
  const [dirty, setDirty] = useState(false)
  const canLeave = () => !dirty || window.confirm('Discard this unsaved note?')
  if (manage) return <ShiftDetailDrawer shift={visit} onClose={onClose} />
  return (
    <ClientDialog
      title="Visit details"
      onClose={() => {
        if (canLeave()) onClose()
      }}
    >
      <div className="cw-stack">
        <div className="cw-between">
          <h3>{format(parseISO(visit.date), 'EEEE, MMM d')}</h3>
          <ShiftStatusBadge status={visit.completion_status} />
        </div>
        <dl className="cw-form-grid">
          {[
            [
              'Time',
              `${format(parseISO(visit.start_time), 'HH:mm')} – ${format(parseISO(visit.end_time), 'HH:mm')}`,
            ],
            ['Duration', `${fmtHours(visitHours(visit))}h`],
            ['Worker', `${visit.worker.first_name} ${visit.worker.last_name}`],
            ['Service', serviceName(visit.service_type)],
            ['Location', visit.location || 'Not recorded'],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="cw-label">{label}</dt>
              <dd className="mt-2">{value}</dd>
            </div>
          ))}
        </dl>
        {visit.notes && (
          <div>
            <p className="cw-label mb-2">Visit instructions</p>
            <p className="whitespace-pre-wrap">{visit.notes}</p>
          </div>
        )}
        <button
          className="cw-btn self-start"
          onClick={() => {
            if (canLeave()) setManage(true)
          }}
        >
          <Pencil size={14} /> Manage visit
        </button>
        <div className="border-t border-line-soft pt-6">
          <VisitNotes
            shiftId={visit.shift_id}
            date={visit.date}
            onDirtyChange={setDirty}
          />
        </div>
      </div>
    </ClientDialog>
  )
}
