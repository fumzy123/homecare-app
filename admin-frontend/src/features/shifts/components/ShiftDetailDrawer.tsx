import { useState } from 'react'
import { format, differenceInMinutes } from 'date-fns'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { shiftsApi, type ShiftOccurrence, type NoteEntry } from '@/features/shifts/api'
import { workersApi } from '@/features/workers/api'
import { clientsApi } from '@/features/clients/api'
import { RecurringActionModal, type RecurringScope } from '@/features/shifts/components/RecurringActionModal'
import { Avatar, Kicker } from '@/shared/components/ui'

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; border: string }> = {
  scheduled:   { label: 'Scheduled',   bg: '#FFE2D4', color: '#111111', border: '#111111' },
  in_progress: { label: 'In Progress', bg: '#9DE8DC', color: '#111111', border: '#111111' },
  completed:   { label: 'Completed',   bg: '#111111', color: '#F2EEE5', border: '#111111' },
  no_show:     { label: 'No Show',     bg: '#FF5A1F', color: '#ffffff', border: '#FF5A1F' },
  cancelled:   { label: 'Cancelled',   bg: '#EDE8DC', color: '#8A8378', border: '#8A8378' },
  dropped:     { label: 'Dropped',     bg: '#F4D35E', color: '#111111', border: '#111111' },
}

// ─── Shared form styles ───────────────────────────────────────────────────────

const labelClass = 'block font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mb-1'
const inputClass = 'w-full bg-cream border border-ink px-3 py-2 font-mono text-[11px] text-ink focus:outline-none focus:ring-1 focus:ring-ink'

function formatDuration(start: Date, end: Date): string {
  const mins = differenceInMinutes(end, start)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ShiftDetailDrawerProps {
  shift: ShiftOccurrence
  onClose: () => void
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ShiftDetailDrawer({ shift, onClose }: ShiftDetailDrawerProps) {
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [cancelConfirm, setCancelConfirm] = useState(false)

  const start = new Date(shift.start_time)
  const end   = new Date(shift.end_time)
  const statusCfg = STATUS_CONFIG[shift.completion_status] ?? STATUS_CONFIG.scheduled

  // Edit state
  const [workerId, setWorkerId]               = useState(shift.worker.id)
  const [clientId, setClientId]               = useState(shift.client.id)
  const [date, setDate]                       = useState(format(start, 'yyyy-MM-dd'))
  const [startTime, setStartTime]             = useState(format(start, 'HH:mm'))
  const [endTime, setEndTime]                 = useState(format(end, 'HH:mm'))
  const [location, setLocation]               = useState(shift.location ?? '')
  const [notes, setNotes]                     = useState(shift.notes ?? '')
  const [completionStatus, setCompletionStatus] = useState(shift.completion_status)
  const [editError, setEditError]             = useState<string | null>(null)
  const [saved, setSaved]                     = useState(false)

  const { data: workers = [] } = useQuery({
    queryKey: ['workers'],
    queryFn: workersApi.listWorkers,
    enabled: isEditing && !shift.is_recurring,
  })

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientsApi.listClients(),
    enabled: isEditing && !shift.is_recurring,
  })

  const saveMutation = useMutation({
    mutationFn: (fn: () => Promise<void>) => fn(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] })
      setSaved(true)
      setIsEditing(false)
      setShowSaveModal(false)
      setTimeout(() => setSaved(false), 2500)
    },
    onError: (err) => {
      setEditError(err instanceof Error ? err.message : 'Something went wrong')
      setShowSaveModal(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (fn: () => Promise<void>) => fn(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] })
      onClose()
    },
  })

  function handleSave() {
    setEditError(null)
    const s = new Date(`${date}T${startTime}`)
    const e = new Date(`${date}T${endTime}`)
    if (e <= s) { setEditError('End time must be after start time.'); return }
    if (shift.is_recurring) {
      setShowSaveModal(true)
    } else {
      saveMutation.mutate(async () => {
        await shiftsApi.updateShift(shift.shift_id, {
          worker_id: workerId, client_id: clientId,
          start_time: s.toISOString(), end_time: e.toISOString(),
          location: location || undefined, notes: notes || undefined,
        })
        if (completionStatus !== shift.completion_status) {
          await shiftsApi.createModification(shift.shift_id, {
            original_date: shift.date, completion_status: completionStatus,
          })
        }
      })
    }
  }

  function executeSave(scope: RecurringScope) {
    const startISO = new Date(`${date}T${startTime}`).toISOString()
    const endISO   = new Date(`${date}T${endTime}`).toISOString()
    if (scope === 'this') {
      const originalDate = shift.date
      if (shift.is_modification) {
        saveMutation.mutate(() => shiftsApi.updateModification(shift.shift_id, originalDate, {
          new_start_time: startISO, new_end_time: endISO,
          completion_status: completionStatus, notes: notes || undefined,
        }))
      } else {
        saveMutation.mutate(() => shiftsApi.createModification(shift.shift_id, {
          original_date: originalDate, new_start_time: startISO, new_end_time: endISO,
          completion_status: completionStatus, notes: notes || undefined,
        }))
      }
    } else if (scope === 'following') {
      saveMutation.mutate(() => shiftsApi.editFromDate(shift.shift_id, shift.date, {
        new_start_time: startISO, new_end_time: endISO, notes: notes || undefined,
      }))
    } else {
      saveMutation.mutate(() => shiftsApi.updateShift(shift.shift_id, {
        start_time: startISO, end_time: endISO, notes: notes || undefined,
      }))
    }
  }

  function executeDelete(scope: RecurringScope) {
    if (scope === 'this') deleteMutation.mutate(() => shiftsApi.cancelOccurrence(shift.shift_id, shift.date))
    else if (scope === 'following') deleteMutation.mutate(() => shiftsApi.cancelFromDate(shift.shift_id, shift.date))
    else deleteMutation.mutate(() => shiftsApi.cancelShift(shift.shift_id))
    setShowDeleteModal(false)
  }

  function handleDiscard() {
    setWorkerId(shift.worker.id); setClientId(shift.client.id)
    setDate(format(start, 'yyyy-MM-dd')); setStartTime(format(start, 'HH:mm')); setEndTime(format(end, 'HH:mm'))
    setLocation(shift.location ?? ''); setNotes(shift.notes ?? '')
    setCompletionStatus(shift.completion_status); setEditError(null); setIsEditing(false)
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-ink/20" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 z-50 flex w-[400px] flex-col bg-paper border-l border-ink">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink">
          <Kicker>{isEditing ? 'Edit Shift' : 'Shift Details'}</Kicker>
          <div className="flex items-center gap-2">
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="font-mono text-[10px] tracking-[0.05em] uppercase text-ink-soft hover:text-ink transition-colors"
              >
                Edit
              </button>
            )}
            <button onClick={onClose} className="font-mono text-[16px] text-ink-soft hover:text-ink leading-none">×</button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6">

          {isEditing ? (
            /* ── Edit mode ── */
            <>
              {shift.is_recurring && (
                <p className="font-mono text-[10px] text-ink-soft border border-ink px-3 py-2 tracking-wide">
                  ↻ Changes apply to this shift, following, or all — you'll choose on save.
                </p>
              )}

              {!shift.is_recurring && (
                <div>
                  <label className={labelClass}>Worker</label>
                  <select className={inputClass} value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
                    {workers.map((w) => <option key={w.id} value={w.id}>{w.first_name} {w.last_name}</option>)}
                  </select>
                </div>
              )}

              {!shift.is_recurring && (
                <div>
                  <label className={labelClass}>Client</label>
                  <select className={inputClass} value={clientId} onChange={(e) => setClientId(e.target.value)}>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className={labelClass}>Date</label>
                <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Start Time</label>
                  <input type="time" className={inputClass} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>End Time</label>
                  <input type="time" className={inputClass} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </div>
              </div>

              {!shift.is_recurring && (
                <div>
                  <label className={labelClass}>Location</label>
                  <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Address" />
                </div>
              )}

              <div>
                <label className={labelClass}>Notes</label>
                <textarea className={`${inputClass} resize-none`} rows={3} value={notes}
                  onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
              </div>

              <div>
                <label className={labelClass}>Status</label>
                <select className={inputClass} value={completionStatus} onChange={(e) => setCompletionStatus(e.target.value)}>
                  {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
                    <option key={val} value={val}>{cfg.label}</option>
                  ))}
                </select>
                {shift.is_recurring && (
                  <p className="mt-1 font-mono text-[9px] text-ink-soft">Status changes apply to this occurrence only.</p>
                )}
              </div>

              {editError && (
                <p className="font-mono text-[10px] text-orange border border-orange px-3 py-2">{editError}</p>
              )}
            </>

          ) : (
            /* ── View mode ── */
            <>
              {/* Date / time / status block */}
              <div className="border border-ink px-4 py-4" style={{ borderLeftWidth: 3, borderLeftColor: statusCfg.bg }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-serif text-[20px] leading-snug tracking-[-0.01em]">
                      {format(start, 'EEEE, MMM d')}
                    </p>
                    <p className="font-mono text-[11px] text-ink-soft mt-1">
                      {format(start, 'HH:mm')} → {format(end, 'HH:mm')} · {formatDuration(start, end)}
                    </p>
                  </div>
                  <span
                    className="font-mono text-[9px] tracking-[0.08em] uppercase px-2 py-1 shrink-0"
                    style={{ background: statusCfg.bg, color: statusCfg.color, border: `1px solid ${statusCfg.border}` }}
                  >
                    {statusCfg.label}
                  </span>
                </div>

                {/* Recurring / modified badges */}
                {(shift.is_recurring || shift.is_modification) && (
                  <div className="flex gap-2 mt-3">
                    {shift.is_recurring && (
                      <span className="font-mono text-[9px] tracking-[0.08em] uppercase border border-ink px-2 py-0.5 text-ink-soft">
                        ↻ Recurring
                      </span>
                    )}
                    {shift.is_modification && (
                      <span className="font-mono text-[9px] tracking-[0.08em] uppercase border border-orange px-2 py-0.5 text-orange">
                        Modified
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Location */}
              {shift.location && (
                <div>
                  <p className={labelClass}>Location</p>
                  <p className="font-mono text-[11px]">{shift.location}</p>
                </div>
              )}

              {/* Worker */}
              <div>
                <p className={labelClass}>Worker</p>
                <div className="flex items-center gap-3 mt-1">
                  <Avatar
                    initials={`${shift.worker.first_name[0]}${shift.worker.last_name[0]}`}
                    color="c1" size="sm"
                  />
                  <div>
                    <p className="text-[13px] font-medium">{shift.worker.first_name} {shift.worker.last_name}</p>
                    <p className="font-mono text-[10px] text-ink-soft">{shift.worker.email}</p>
                  </div>
                </div>
              </div>

              {/* Client */}
              <div>
                <p className={labelClass}>Client</p>
                <div className="flex items-center gap-3 mt-1">
                  <Avatar
                    initials={`${shift.client.first_name[0]}${shift.client.last_name[0]}`}
                    color="c2" size="sm"
                  />
                  <p className="text-[13px] font-medium">{shift.client.first_name} {shift.client.last_name}</p>
                </div>
              </div>

              {/* Notes */}
              <div>
                <p className={labelClass}>Notes</p>
                {shift.notes
                  ? <p className="font-mono text-[11px] text-ink whitespace-pre-wrap">{shift.notes}</p>
                  : <p className="font-mono text-[10px] text-muted">No notes</p>
                }
              </div>

              {/* Progress notes */}
              <ProgressNotesSection shift={shift} />

              {saved && (
                <p className="font-mono text-[10px] text-mint tracking-wide uppercase text-center">Changes saved ✓</p>
              )}

              {/* Delete / cancel */}
              <div className="mt-auto border-t border-ink pt-5">
                {shift.is_recurring ? (
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    disabled={deleteMutation.isPending}
                    className="w-full border border-orange text-orange py-2 font-mono text-[10px] tracking-[0.08em] uppercase hover:bg-orange hover:text-white transition-colors disabled:opacity-40"
                  >
                    {deleteMutation.isPending ? 'Deleting…' : 'Delete Shift'}
                  </button>
                ) : !cancelConfirm ? (
                  <button
                    onClick={() => setCancelConfirm(true)}
                    className="w-full border border-orange text-orange py-2 font-mono text-[10px] tracking-[0.08em] uppercase hover:bg-orange hover:text-white transition-colors"
                  >
                    Cancel Shift
                  </button>
                ) : (
                  <div className="flex flex-col gap-2">
                    <p className="font-mono text-[10px] text-ink-soft text-center tracking-wide">Cancel this shift?</p>
                    <button
                      onClick={() => deleteMutation.mutate(() => shiftsApi.cancelShift(shift.shift_id))}
                      disabled={deleteMutation.isPending}
                      className="w-full bg-orange text-white py-2 font-mono text-[10px] tracking-[0.08em] uppercase hover:opacity-80 disabled:opacity-40 transition-opacity"
                    >
                      {deleteMutation.isPending ? 'Cancelling…' : 'Yes, cancel it'}
                    </button>
                    <button
                      onClick={() => setCancelConfirm(false)}
                      className="w-full border border-ink py-2 font-mono text-[10px] tracking-[0.08em] uppercase text-ink-soft hover:text-ink transition-colors"
                    >
                      Keep Shift
                    </button>
                    {deleteMutation.isError && (
                      <p className="font-mono text-[10px] text-orange text-center">
                        {deleteMutation.error instanceof Error ? deleteMutation.error.message : 'Something went wrong'}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Edit footer ── */}
        {isEditing && (
          <div className="border-t border-ink px-6 py-4 flex justify-end gap-3">
            <button onClick={handleDiscard}
              className="border border-ink px-4 py-2 font-mono text-[10px] tracking-[0.08em] uppercase text-ink-soft hover:text-ink transition-colors">
              Discard
            </button>
            <button onClick={handleSave} disabled={saveMutation.isPending}
              className="bg-ink text-cream px-5 py-2 font-mono text-[10px] tracking-[0.08em] uppercase hover:opacity-80 disabled:opacity-40 transition-opacity">
              {saveMutation.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      {showDeleteModal && (
        <RecurringActionModal mode="delete" onConfirm={executeDelete} onCancel={() => setShowDeleteModal(false)} />
      )}
      {showSaveModal && (
        <RecurringActionModal mode="edit" onConfirm={executeSave} onCancel={() => setShowSaveModal(false)} />
      )}
    </>
  )
}

// ─── Progress Notes ───────────────────────────────────────────────────────────

function ProgressNotesSection({ shift }: { shift: ShiftOccurrence }) {
  const queryClient = useQueryClient()
  const shiftStart = format(new Date(shift.start_time), 'HH:mm')
  const shiftEnd   = format(new Date(shift.end_time),   'HH:mm')

  const [addingEntry, setAddingEntry] = useState(false)
  const [newTime, setNewTime]         = useState(shiftStart)
  const [newContent, setNewContent]   = useState('')

  const { data: note } = useQuery({
    queryKey: ['progress-note', shift.shift_id, shift.date],
    queryFn: () => shiftsApi.getProgressNote(shift.shift_id, shift.date),
  })

  const entries: NoteEntry[] = note?.entries ?? []
  const sorted = [...entries].sort((a, b) => a.time.localeCompare(b.time))

  const saveMutation = useMutation({
    mutationFn: (updated: NoteEntry[]) =>
      shiftsApi.upsertProgressNote(shift.shift_id, shift.date, updated),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['progress-note', shift.shift_id, shift.date] })
    },
  })

  function handleAdd() {
    if (!newContent.trim()) return
    saveMutation.mutate([...entries, { time: newTime, content: newContent.trim() }])
    setNewContent(''); setNewTime(shiftStart); setAddingEntry(false)
  }

  function handleDelete(index: number) {
    saveMutation.mutate(sorted.filter((_, i) => i !== index))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft">Progress Notes</p>
        {!addingEntry && (
          <button onClick={() => setAddingEntry(true)}
            className="font-mono text-[9px] tracking-[0.05em] uppercase text-ink-soft hover:text-ink transition-colors">
            + Add
          </button>
        )}
      </div>

      {sorted.length === 0 && !addingEntry && (
        <p className="font-mono text-[10px] text-muted">No entries yet</p>
      )}

      <div className="space-y-2">
        {sorted.map((entry, i) => (
          <div key={i} className="flex items-start gap-3 border border-dashed border-line-soft px-3 py-2.5">
            <span className="font-mono text-[10px] text-ink-soft shrink-0 w-14 pt-px">
              {format(new Date(`1970-01-01T${entry.time}`), 'HH:mm')}
            </span>
            <p className="flex-1 font-mono text-[11px] text-ink leading-snug">{entry.content}</p>
            <button onClick={() => handleDelete(i)}
              className="font-mono text-[12px] text-muted hover:text-orange transition-colors shrink-0">
              ×
            </button>
          </div>
        ))}
      </div>

      {addingEntry && (
        <div className="mt-3 border border-ink p-3 space-y-3">
          <div className="flex items-center gap-3">
            <label className="font-mono text-[9px] uppercase text-ink-soft w-10 shrink-0">Time</label>
            <input type="time" min={shiftStart} max={shiftEnd} value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              className="bg-cream border border-ink px-2 py-1.5 font-mono text-[11px] focus:outline-none" />
          </div>
          <textarea rows={2} value={newContent} onChange={(e) => setNewContent(e.target.value)}
            placeholder="What happened at this time?"
            className="w-full resize-none bg-cream border border-ink px-3 py-2 font-mono text-[11px] focus:outline-none"
            autoFocus />
          <div className="flex justify-end gap-2">
            <button onClick={() => { setAddingEntry(false); setNewContent('') }}
              className="border border-ink px-3 py-1.5 font-mono text-[9px] uppercase text-ink-soft hover:text-ink transition-colors">
              Cancel
            </button>
            <button onClick={handleAdd} disabled={!newContent.trim() || saveMutation.isPending}
              className="bg-ink text-cream px-3 py-1.5 font-mono text-[9px] uppercase hover:opacity-80 disabled:opacity-40 transition-opacity">
              {saveMutation.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
