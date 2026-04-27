import { useState } from 'react'
import { getStatusToken, STATUS_TOKENS, ADMIN_SELECTABLE_STATUSES } from '@/shared/lib/shiftStatus'
import { CANCELLATION_REASONS } from '@/shared/lib/cancellationReasons'
import { format, differenceInMinutes } from 'date-fns'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { shiftsApi, type ShiftOccurrence, type NoteEntry } from '@/features/shifts/api'
import { workersApi } from '@/features/workers/api'
import { clientsApi } from '@/features/clients/api'
import { RecurringActionModal, type RecurringScope } from '@/features/shifts/components/RecurringActionModal'
import { Avatar, Kicker } from '@/shared/components/ui'

// ─── Status config ────────────────────────────────────────────────────────────


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
  const [isEditing, setIsEditing]         = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showCancelFlow, setShowCancelFlow]   = useState(false)
  const [cancelScope, setCancelScope]         = useState<'this' | 'following' | 'all'>('this')
  const [cancelReason, setCancelReason]       = useState('')
  const [cancelReasonOther, setCancelReasonOther] = useState('')

  const start = new Date(shift.start_time)
  const end   = new Date(shift.end_time)
  const statusCfg = getStatusToken(shift.completion_status)

  // Edit state
  const [workerId, setWorkerId]               = useState(shift.worker.id)
  const [clientId, setClientId]               = useState(shift.client.id)
  const [date, setDate]                       = useState(format(start, 'yyyy-MM-dd'))
  const [endDate, setEndDate]                 = useState(format(end, 'yyyy-MM-dd'))
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

  function nextDay(d: string): string {
    const dt = new Date(`${d}T00:00`)
    dt.setDate(dt.getDate() + 1)
    return format(dt, 'yyyy-MM-dd')
  }

  function handleSave() {
    setEditError(null)
    const s = new Date(`${date}T${startTime}`)
    const e = new Date(`${endDate}T${endTime}`)
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
    const endISO   = new Date(`${endDate}T${endTime}`).toISOString()
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

  function confirmCancel() {
    const reason = cancelReason === 'other' ? cancelReasonOther : cancelReason
    const scope  = shift.is_recurring ? cancelScope : 'all'
    if (scope === 'this')      deleteMutation.mutate(() => shiftsApi.cancelOccurrence(shift.shift_id, shift.date, reason))
    else if (scope === 'following') deleteMutation.mutate(() => shiftsApi.cancelFromDate(shift.shift_id, shift.date, reason))
    else                       deleteMutation.mutate(() => shiftsApi.cancelShift(shift.shift_id, reason))
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

              {/* Date row — end date appears for overnight shifts */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>{endDate !== date ? 'Start Date' : 'Date'}</label>
                  <input type="date" className={inputClass} value={date}
                    onChange={(e) => {
                      const newDate = e.target.value
                      if (endDate === nextDay(date)) setEndDate(nextDay(newDate))
                      else if (endDate === date) setEndDate(newDate)
                      setDate(newDate)
                    }} />
                </div>
                {endDate !== date && (
                  <div>
                    <label className={labelClass}>End Date</label>
                    <input type="date" className={inputClass} value={endDate}
                      min={date}
                      onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Start Time</label>
                  <input type="time" className={inputClass} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>End Time</label>
                  <input type="time" className={inputClass} value={endTime}
                    onChange={(e) => {
                      const newEnd = e.target.value
                      setEndTime(newEnd)
                      if (newEnd && startTime && newEnd <= startTime && endDate === date)
                        setEndDate(nextDay(date))
                      if (newEnd && startTime && newEnd > startTime && endDate === nextDay(date))
                        setEndDate(date)
                    }} />
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
                  {ADMIN_SELECTABLE_STATUSES.map((val) => (
                    <option key={val} value={val}>{STATUS_TOKENS[val].label}</option>
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

              {/* Cancel shift */}
              <div className="mt-auto border-t border-ink pt-5">
                {!showCancelFlow ? (
                  <button
                    onClick={() => { setShowCancelFlow(true); setCancelReason(''); setCancelScope('this') }}
                    className="w-full border border-orange text-orange py-2 font-mono text-[10px] tracking-[0.08em] uppercase hover:bg-orange hover:text-white transition-colors"
                  >
                    Cancel Shift
                  </button>
                ) : (
                  <div className="flex flex-col gap-4">
                    <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft">
                      Cancellation reason
                    </p>

                    {/* Scope selector — only for recurring shifts */}
                    {shift.is_recurring && (
                      <div className="flex flex-col gap-1.5">
                        {([
                          { value: 'this',      label: 'Just this occurrence'       },
                          { value: 'following', label: 'This and all following'     },
                          { value: 'all',       label: 'All occurrences'            },
                        ] as const).map(({ value, label }) => (
                          <label key={value} className="flex items-center gap-2.5 cursor-pointer">
                            <span className={`w-3.5 h-3.5 border border-ink flex items-center justify-center shrink-0 ${cancelScope === value ? 'bg-ink' : ''}`}>
                              {cancelScope === value && <span className="w-1.5 h-1.5 bg-cream block" />}
                            </span>
                            <span className="font-mono text-[10px] text-ink">{label}</span>
                            <input type="radio" className="sr-only" value={value} checked={cancelScope === value} onChange={() => setCancelScope(value)} />
                          </label>
                        ))}
                      </div>
                    )}

                    {/* Reason list */}
                    <div className="flex flex-col gap-1.5">
                      {CANCELLATION_REASONS.map(({ value, label }) => (
                        <label key={value} className="flex items-center gap-2.5 cursor-pointer">
                          <span className={`w-3.5 h-3.5 border border-ink flex items-center justify-center shrink-0 ${cancelReason === value ? 'bg-ink' : ''}`}>
                            {cancelReason === value && <span className="w-1.5 h-1.5 bg-cream block" />}
                          </span>
                          <span className="font-mono text-[10px] text-ink">{label}</span>
                          <input type="radio" className="sr-only" value={value} checked={cancelReason === value} onChange={() => setCancelReason(value)} />
                        </label>
                      ))}
                    </div>

                    {/* Other free text */}
                    {cancelReason === 'other' && (
                      <input
                        className={inputClass}
                        placeholder="Describe the reason…"
                        value={cancelReasonOther}
                        onChange={(e) => setCancelReasonOther(e.target.value)}
                      />
                    )}

                    {deleteMutation.isError && (
                      <p className="font-mono text-[10px] text-orange">
                        {deleteMutation.error instanceof Error ? deleteMutation.error.message : 'Something went wrong'}
                      </p>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowCancelFlow(false)}
                        className="flex-1 border border-ink py-2 font-mono text-[10px] tracking-[0.08em] uppercase text-ink-soft hover:text-ink transition-colors"
                      >
                        Back
                      </button>
                      <button
                        onClick={confirmCancel}
                        disabled={!cancelReason || (cancelReason === 'other' && !cancelReasonOther.trim()) || deleteMutation.isPending}
                        className="flex-1 bg-orange text-white py-2 font-mono text-[10px] tracking-[0.08em] uppercase hover:opacity-80 disabled:opacity-40 transition-opacity"
                      >
                        {deleteMutation.isPending ? 'Cancelling…' : 'Confirm Cancel'}
                      </button>
                    </div>
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
