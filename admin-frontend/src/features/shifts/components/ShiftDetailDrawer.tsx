import { useState, useRef } from 'react'
import { getStatusToken, STATUS_TOKENS, ADMIN_SELECTABLE_STATUSES } from '@/shared/lib/shiftStatus'
import { CANCELLATION_REASONS } from '@/shared/lib/cancellationReasons'
import { format, differenceInMinutes } from 'date-fns'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { shiftsApi, type ShiftOccurrence, type NoteEntry, type RecurrenceFrequency, type DayOfWeek, ORDERED_DAYS, DAY_LABELS } from '@/features/shifts/api'
import { orgMembersApi } from '@/features/org-members/api'
import { clientsApi } from '@/features/clients/api'
import { RecurringActionModal, type RecurringScope } from '@/features/shifts/components/RecurringActionModal'
import { Avatar, Kicker, DateInput, TimeInput } from '@/shared/components/ui'
import { ApiError } from '@/shared/lib/api-client'

// ─── Status config ────────────────────────────────────────────────────────────


// ─── Shared form styles ───────────────────────────────────────────────────────

const labelClass = 'block font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mb-1'
const inputClass = 'w-full bg-cream border border-ink px-3 py-2 font-mono text-[11px] text-ink focus:outline-none focus:ring-1 focus:ring-ink'

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function formatWeekRange(weekStart: string, weekEnd: string): string {
  const [sy, sm, sd] = weekStart.split('-').map(Number)
  const [ey, em, ed] = weekEnd.split('-').map(Number)
  const s = new Date(sy, sm - 1, sd)
  const e = new Date(ey, em - 1, ed)
  return `${format(s, 'MMMM')} ${ordinal(s.getDate())} to ${format(e, 'MMMM')} ${ordinal(e.getDate())}, ${e.getFullYear()}`
}

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
  hideEdit?: boolean
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ShiftDetailDrawer({ shift, onClose, hideEdit = false }: ShiftDetailDrawerProps) {
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
  const [recurrenceEndDate, setRecurrenceEndDate]   = useState(shift.recurrence_end_date ?? '')
  const [recurrenceFreq, setRecurrenceFreq]         = useState<RecurrenceFrequency>(shift.recurrence_frequency ?? 'weekly')
  const [recurrenceDays, setRecurrenceDays]         = useState<DayOfWeek[]>(shift.recurrence_days_of_week ?? [])
  const [editError, setEditError]             = useState<string | null>(null)
  const [pendingOverride, setPendingOverride] = useState<{ code: string; message: string } | null>(null)
  const overrideRef                           = useRef(false)
  const pendingOverrideFnRef                  = useRef<(() => void) | null>(null)
  const [saved, setSaved]                     = useState(false)

  const { data: workers = [] } = useQuery({
    queryKey: ['workers'],
    queryFn: () => orgMembersApi.listByRole('home_support_worker'),
    enabled: isEditing,
  })

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientsApi.listClients(),
    enabled: isEditing,
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
      if (err instanceof ApiError && err.code === 'WORKER_ALREADY_SCHEDULED_AT_THIS_TIME_BLOCK' && Array.isArray(err.details) && err.details.length > 0) {
        const first = err.details[0] as { date: string; start: string; end: string; client_name: string }
        const s = new Date(first.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        const e = new Date(first.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        setEditError(`Worker already scheduled on ${first.date} (${s}–${e}) for ${first.client_name}.`)
      } else if (err instanceof ApiError && err.code === 'WORKER_WOULD_ENTER_OVERTIME' && Array.isArray(err.details) && err.details.length > 0) {
        const first = err.details[0] as { week_start: string; week_end: string; worker_name: string; total_hours: number; overtime_threshold: number }
        const over = Math.round((first.total_hours - first.overtime_threshold) * 10) / 10
        setPendingOverride({
          code: err.code,
          message: `${first.worker_name} would reach ${first.total_hours}h the week of ${formatWeekRange(first.week_start, first.week_end)} — ${over}h over the 40h overtime threshold. Approve overtime?`,
        })
      } else if (err instanceof ApiError && err.code === 'WORKER_WOULD_EXCEED_WEEKLY_CAP' && Array.isArray(err.details) && err.details.length > 0) {
        const first = err.details[0] as { week_start: string; week_end: string; worker_name: string; total_hours: number; max_hours: number }
        const over = Math.round((first.total_hours - first.max_hours) * 10) / 10
        setPendingOverride({
          code: err.code,
          message: `${first.worker_name} would reach ${first.total_hours}h the week of ${formatWeekRange(first.week_start, first.week_end)} — ${over}h over their ${first.max_hours}h/week cap. Schedule anyway?`,
        })
      } else {
        setEditError(err instanceof Error ? err.message : 'Something went wrong')
      }
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
    if (shift.is_recurring) {
      setShowSaveModal(true)
    } else {
      saveMutation.mutate(async () => {
        await shiftsApi.updateShift(shift.shift_id, {
          worker_id: workerId, client_id: clientId,
          start_time: `${date}T${startTime}:00`, end_time: `${endDate}T${endTime}:00`,
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

  function buildRecurrencePayload() {
    return {
      frequency: recurrenceFreq,
      ...(recurrenceFreq === 'weekly' ? { days_of_week: recurrenceDays } : {}),
      ...(recurrenceEndDate ? { recurrence_end_date: recurrenceEndDate } : {}),
    }
  }

  function recurrenceChanged() {
    return (
      recurrenceFreq !== (shift.recurrence_frequency ?? 'weekly') ||
      JSON.stringify([...(recurrenceDays)].sort()) !== JSON.stringify([...(shift.recurrence_days_of_week ?? [])].sort())
    )
  }

  function executeSave(scope: RecurringScope) {
    const override = overrideRef.current
    overrideRef.current = false

    // Register a retry function so the approve button can re-run the same scope
    pendingOverrideFnRef.current = () => {
      overrideRef.current = true
      executeSave(scope)
    }

    const startISO = `${date}T${startTime}:00`
    const endISO   = `${endDate}T${endTime}:00`
    if (scope === 'this') {
      const originalDate = shift.date
      if (shift.is_modification) {
        saveMutation.mutate(() => shiftsApi.updateModification(shift.shift_id, originalDate, {
          new_start_time: startISO, new_end_time: endISO,
          completion_status: completionStatus, notes: notes || undefined,
          override_hours_check: override,
        }))
      } else {
        saveMutation.mutate(() => shiftsApi.createModification(shift.shift_id, {
          original_date: originalDate, new_start_time: startISO, new_end_time: endISO,
          completion_status: completionStatus, notes: notes || undefined,
          override_hours_check: override,
        }))
      }
    } else if (scope === 'following') {
      saveMutation.mutate(() => shiftsApi.editFromDate(shift.shift_id, shift.date, {
        new_start_time: startISO, new_end_time: endISO,
        worker_id: workerId !== shift.worker.id ? workerId : undefined,
        client_id: clientId !== shift.client.id ? clientId : undefined,
        location: location || undefined,
        recurrence_end_date: recurrenceEndDate || undefined,
        recurrence: recurrenceChanged() ? buildRecurrencePayload() : undefined,
        notes: notes || undefined,
        override_hours_check: override,
      }))
    } else {
      saveMutation.mutate(() => shiftsApi.updateShift(shift.shift_id, {
        worker_id: workerId, client_id: clientId,
        start_time: startISO, end_time: endISO,
        location: location || undefined,
        recurrence_end_date: recurrenceEndDate || undefined,
        recurrence: recurrenceChanged() ? buildRecurrencePayload() : undefined,
        notes: notes || undefined,
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
    setCompletionStatus(shift.completion_status)
    setRecurrenceEndDate(shift.recurrence_end_date ?? '')
    setRecurrenceFreq(shift.recurrence_frequency ?? 'weekly')
    setRecurrenceDays(shift.recurrence_days_of_week ?? [])
    setEditError(null); setPendingOverride(null); setIsEditing(false)
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-ink/20" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[400px] flex-col bg-paper border-l border-ink">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink">
          <Kicker>{isEditing ? 'Edit Shift' : 'Shift Details'}</Kicker>
          <div className="flex items-center gap-2">
            {!isEditing && !hideEdit && (
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

              <div>
                <label className={labelClass}>Worker</label>
                <select className={inputClass} value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
                  {workers.map((w) => <option key={w.id} value={w.id}>{w.first_name} {w.last_name}</option>)}
                </select>
              </div>

              <div>
                <label className={labelClass}>Client</label>
                <select className={inputClass} value={clientId} onChange={(e) => setClientId(e.target.value)}>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                </select>
              </div>

              {/* Date row — end date appears for overnight shifts */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>{endDate !== date ? 'Start Date' : 'Date'}</label>
                  <DateInput value={date}
                    onChange={(v) => {
                      if (endDate === nextDay(date)) setEndDate(nextDay(v))
                      else if (endDate === date) setEndDate(v)
                      setDate(v)
                    }} className="w-full" />
                </div>
                {endDate !== date && (
                  <div>
                    <label className={labelClass}>End Date</label>
                    <DateInput value={endDate} min={date} onChange={setEndDate} className="w-full" />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Start Time</label>
                  <TimeInput value={startTime} onChange={setStartTime} className="w-full" />
                </div>
                <div>
                  <label className={labelClass}>End Time</label>
                  <TimeInput value={endTime} className="w-full"
                    onChange={(newEnd) => {
                      setEndTime(newEnd)
                      if (newEnd && startTime && newEnd <= startTime && endDate === date)
                        setEndDate(nextDay(date))
                      if (newEnd && startTime && newEnd > startTime && endDate === nextDay(date))
                        setEndDate(date)
                    }} />
                </div>
              </div>

              <div>
                <label className={labelClass}>Location</label>
                <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Address" />
              </div>

              {shift.is_recurring && (
                <>
                  <div>
                    <label className={labelClass}>Repeat frequency</label>
                    <select
                      className={inputClass}
                      value={recurrenceFreq}
                      onChange={(e) => {
                        setRecurrenceFreq(e.target.value as RecurrenceFrequency)
                        if (e.target.value === 'daily') setRecurrenceDays([])
                      }}
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                    </select>
                  </div>

                  {recurrenceFreq === 'weekly' && (
                    <div>
                      <label className={labelClass}>Repeat on</label>
                      <div className="flex gap-1.5 flex-wrap">
                        {ORDERED_DAYS.map((day) => {
                          const active = recurrenceDays.includes(day)
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => setRecurrenceDays(
                                active
                                  ? recurrenceDays.filter((d) => d !== day)
                                  : [...recurrenceDays, day]
                              )}
                              className={`px-2.5 py-1 font-mono text-[9px] tracking-wide uppercase border transition-colors ${
                                active ? 'bg-ink text-cream border-ink' : 'border-ink text-ink-soft hover:text-ink'
                              }`}
                            >
                              {DAY_LABELS[day]}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className={labelClass}>Recurrence ends</label>
                    <DateInput value={recurrenceEndDate} onChange={setRecurrenceEndDate} className="w-full" />
                    <p className="mt-1 font-mono text-[9px] text-ink-soft">Leave blank for no end date.</p>
                  </div>
                </>
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

              {pendingOverride && (
                <div className="border border-orange bg-cream-2 px-4 py-3 flex flex-col gap-3">
                  <p className="font-mono text-[10px] text-ink leading-relaxed">{pendingOverride.message}</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const fn = pendingOverrideFnRef.current
                        setPendingOverride(null)
                        fn?.()
                      }}
                      className="bg-ink text-cream px-4 py-1.5 font-mono text-[10px] tracking-[0.08em] uppercase hover:opacity-80 transition-opacity"
                    >
                      {pendingOverride.code === 'WORKER_WOULD_ENTER_OVERTIME' ? 'Approve overtime' : 'Schedule anyway'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingOverride(null)}
                      className="border border-ink px-4 py-1.5 font-mono text-[10px] tracking-[0.08em] uppercase text-ink-soft hover:text-ink transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
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
        <RecurringActionModal
          mode="edit"
          recurrenceRuleChanged={recurrenceChanged()}
          onConfirm={executeSave}
          onCancel={() => setShowSaveModal(false)}
        />
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
            <TimeInput value={newTime} min={shiftStart} max={shiftEnd} onChange={setNewTime} />
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
