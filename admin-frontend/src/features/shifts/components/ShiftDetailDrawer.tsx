import { VisitDrawer, VisitFormSection } from './VisitDrawerUI'
import { useRequestOvertime } from '../hooks/useOvertimeMutations'
import { useEffect, useState, useRef } from 'react'
import { getStatusToken, STATUS_TOKENS, ADMIN_SELECTABLE_STATUSES } from '@/shared/lib/shiftStatus'
import { CANCELLATION_REASONS } from '@/shared/lib/cancellationReasons'
import { format, differenceInMinutes } from 'date-fns'
import { useQueryClient } from '@tanstack/react-query'
import { shiftsApi, type ShiftOccurrence, type NoteEntry, type RecurrenceFrequency, type DayOfWeek, ORDERED_DAYS, DAY_LABELS } from '@/features/shifts/api'
import { useShiftDetailWorkers, useShiftDetailClients, useShiftDetailWrite, useShiftDetailNote, useSaveShiftDetailNote } from '../hooks/useShiftDetail'
import { RecurringActionModal, type RecurringScope } from '@/features/shifts/components/RecurringActionModal'
import { Avatar, DateInput, TimeInput } from '@/shared/components/ui'
import { ApiError } from '@/shared/lib/api-client'
import { visitWriteError, isVisitConnectionError } from '../lib/visitWrite'

// ─── Status config ────────────────────────────────────────────────────────────


// ─── Shared form styles ───────────────────────────────────────────────────────

const labelClass = 'vd-label'
const inputClass = 'vd-input'

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
  const requestOvertime = useRequestOvertime()
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
  const [pendingOverride, setPendingOverride] = useState<{
    code: string
    message: string
    workerIdForApproval?: string
    weekStart?: string
    weekEnd?: string
    totalHours?: number
  } | null>(null)
  const [approvalRequested, setApprovalRequested] = useState(false)
  const feedbackRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (editError || pendingOverride || approvalRequested) feedbackRef.current?.scrollIntoView?.({ block: 'nearest' })
  }, [editError, pendingOverride, approvalRequested])
  const requestedScope = useRef<RecurringScope>('all')
  const overrideRef                           = useRef(false)
  const pendingOverrideFnRef                  = useRef<(() => void) | null>(null)
  const [saved, setSaved]                     = useState(false)

  const { data: workers = [] } = useShiftDetailWorkers(isEditing)
  const { data: clients = [] } = useShiftDetailClients(isEditing)

  const saveMutation = useShiftDetailWrite({
    onSuccess: () => {
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
      } else if (err instanceof ApiError && err.code === 'OVERTIME_APPROVAL_REQUIRED' && Array.isArray(err.details) && err.details.length > 0) {
        const first = err.details[0] as { week_start: string; week_end: string; worker_id: string; worker_name: string; total_hours: number }
        const over = Math.round((first.total_hours - 40) * 10) / 10
        setPendingOverride({
          code: err.code,
          message: `${first.worker_name} would reach ${first.total_hours}h the week of ${formatWeekRange(first.week_start, first.week_end)} — ${over}h over the 40h overtime threshold. A manager or owner must approve this shift.`,
          workerIdForApproval: first.worker_id,
          weekStart: first.week_start,
          weekEnd: first.week_end,
          totalHours: first.total_hours,
        })
      } else if (err instanceof ApiError && err.code === 'WORKER_WOULD_EXCEED_WEEKLY_CAP' && Array.isArray(err.details) && err.details.length > 0) {
        const first = err.details[0] as { week_start: string; week_end: string; worker_name: string; total_hours: number; max_hours: number }
        const over = Math.round((first.total_hours - first.max_hours) * 10) / 10
        setPendingOverride({
          code: err.code,
          message: `${first.worker_name} would reach ${first.total_hours}h the week of ${formatWeekRange(first.week_start, first.week_end)} — ${over}h over their ${first.max_hours}h/week cap. Schedule anyway?`,
        })
      } else {
        setEditError(visitWriteError(err))
      }
      setShowSaveModal(false)
    },
  })

  const deleteMutation = useShiftDetailWrite({
    onSuccess: () => {
      onClose()
    },
  })

  function nextDay(d: string): string {
    const dt = new Date(`${d}T00:00`)
    dt.setDate(dt.getDate() + 1)
    return format(dt, 'yyyy-MM-dd')
  }

  function handleSave() {
    if (saveMutation.isPending) return
    setEditError(null)
    if (shift.is_recurring) {
      setShowSaveModal(true)
    } else {
      const saveNonRecurring = async (override = false) => {
        await shiftsApi.updateShift(shift.shift_id, {
          worker_id: workerId, client_id: clientId,
          start_time: `${date}T${startTime}:00`, end_time: `${endDate}T${endTime}:00`,
          location: location || undefined, notes: notes || undefined,
          override_hours_check: override,
        })
        if (completionStatus !== shift.completion_status) {
          await shiftsApi.createModification(shift.shift_id, {
            original_date: shift.date, completion_status: completionStatus,
          })
        }
      }
      pendingOverrideFnRef.current = () => saveMutation.mutate(() => saveNonRecurring(true))
      saveMutation.mutate(() => saveNonRecurring())
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
    if (saveMutation.isPending) return
    setEditError(null)
    requestedScope.current = scope
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
        override_hours_check: override,
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
    if (saveMutation.isPending) return
    setWorkerId(shift.worker.id); setClientId(shift.client.id)
    setDate(format(start, 'yyyy-MM-dd')); setStartTime(format(start, 'HH:mm')); setEndTime(format(end, 'HH:mm'))
    setLocation(shift.location ?? ''); setNotes(shift.notes ?? '')
    setCompletionStatus(shift.completion_status)
    setRecurrenceEndDate(shift.recurrence_end_date ?? '')
    setRecurrenceFreq(shift.recurrence_frequency ?? 'weekly')
    setRecurrenceDays(shift.recurrence_days_of_week ?? [])
    setEditError(null); setPendingOverride(null); setIsEditing(false)
  }

  const busy = saveMutation.isPending || deleteMutation.isPending || requestOvertime.isPending
  const dirty = workerId !== shift.worker.id || clientId !== shift.client.id || date !== format(start, 'yyyy-MM-dd') || endDate !== format(end, 'yyyy-MM-dd') || startTime !== format(start, 'HH:mm') || endTime !== format(end, 'HH:mm') || location !== (shift.location ?? '') || notes !== (shift.notes ?? '') || completionStatus !== shift.completion_status || recurrenceChanged() || recurrenceEndDate !== (shift.recurrence_end_date ?? '')
  function requestClose() {
    if (busy) return
    if (!isEditing || !dirty || window.confirm('Discard your unsaved visit changes?')) onClose()
  }

  return (
    <>
      <VisitDrawer title={isEditing ? 'Edit shift' : 'Visit details'}
        subtitle={`${shift.client.first_name} ${shift.client.last_name} · ${format(start, 'EEE, MMM d, yyyy')}`}
        onClose={requestClose} busy={busy}
        action={!isEditing && !hideEdit ? <button className="vd-btn" disabled={busy} onClick={() => setIsEditing(true)}>Edit</button> : undefined}>
        {/* ── Body ── */}
        <div className={`vd-body ${isEditing ? "" : "vd-read"}`}>

          {isEditing ? (
            /* ── Edit mode ── */
            <fieldset disabled={busy} className="vd-form-fields">
              {shift.is_recurring && (
                <p className="vd-notice">
                  This visit is part of a recurring schedule. On save, choose this visit only, this and following visits, or the whole series.
                </p>
              )}

              <VisitFormSection title="People & location" description={shift.is_recurring ? "Worker, client and location changes apply to a series, not a single visit." : undefined}>
              <div className="vd-grid">
              <div>
                <label className={labelClass}>Worker</label>
                <select autoFocus aria-label="Worker" className={inputClass} value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
                  {workers.map((w) => <option key={w.id} value={w.id}>{w.first_name} {w.last_name}</option>)}
                </select>
              </div>

              <div>
                <label className={labelClass}>Client</label>
                <select aria-label="Client" className={inputClass} value={clientId} onChange={(e) => setClientId(e.target.value)}>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                </select>
              </div>

              </div>
              <div>
                <label className={labelClass}>Location</label>
                <input aria-label="Location" className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Address" />
              </div>

              </VisitFormSection>
              <VisitFormSection title="Date & time" description="Times are shown in the agency’s timezone.">
              {/* Date row — end date appears for overnight shifts */}
              <div className="vd-grid">
                <div>
                  <label className={labelClass}>{endDate !== date ? 'Start Date' : 'Date'}</label>
                  <DateInput aria-label="Visit date" value={date}
                    onChange={(v) => {
                      if (endDate === nextDay(date)) setEndDate(nextDay(v))
                      else if (endDate === date) setEndDate(v)
                      setDate(v)
                    }} className="vd-picker" />
                </div>
                {endDate !== date && (
                  <div>
                    <label className={labelClass}>End Date</label>
                    <DateInput aria-label="End date" value={endDate} min={date} onChange={setEndDate} className="vd-picker" />
                  </div>
                )}
              </div>

              <div className="vd-grid">
                <div>
                  <label className={labelClass}>Start Time</label>
                  <TimeInput aria-label="Start time" value={startTime} onChange={setStartTime} className="vd-picker" />
                </div>
                <div>
                  <label className={labelClass}>End Time</label>
                  <TimeInput aria-label="End time" value={endTime} className="vd-picker"
                    onChange={(newEnd) => {
                      setEndTime(newEnd)
                      if (newEnd && startTime && newEnd <= startTime && endDate === date)
                        setEndDate(nextDay(date))
                      if (newEnd && startTime && newEnd > startTime && endDate === nextDay(date))
                        setEndDate(date)
                    }} />
                </div>
              </div>


              </VisitFormSection>
              {shift.is_recurring && (
                <VisitFormSection title="Repeat settings" description="Repeat settings apply to this and following visits or the whole series. They do not change when saving this visit only.">
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
                      <div className="vd-days">
                        {ORDERED_DAYS.map((day) => {
                          const active = recurrenceDays.includes(day)
                          return (
                            <button
                              key={day}
                              aria-pressed={active}
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
                    <DateInput aria-label="Recurrence ends" value={recurrenceEndDate} onChange={setRecurrenceEndDate} className="vd-picker" />
                    <p className="mt-1 font-mono text-[9px] text-ink-soft">Leave blank for no end date.</p>
                  </div>
                </VisitFormSection>
              )}

              <VisitFormSection title="Visit notes & status">
              <div>
                <label className={labelClass}>Notes</label>
                <textarea aria-label="Notes" className={`${inputClass} resize-none`} rows={3} value={notes}
                  onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
              </div>

              <div>
                <label className={labelClass}>Status</label>
                <select aria-label="Status" className={inputClass} value={completionStatus} onChange={(e) => setCompletionStatus(e.target.value)}>
                  {ADMIN_SELECTABLE_STATUSES.map((val) => (
                    <option key={val} value={val}>{STATUS_TOKENS[val].label}</option>
                  ))}
                </select>
                {shift.is_recurring && (
                  <p className="mt-1 font-mono text-[9px] text-ink-soft">Status changes apply to this occurrence only.</p>
                )}
              </div>

              </VisitFormSection>

              <div ref={feedbackRef} className="space-y-4">
              {editError && (
                <p role="alert" className="font-mono text-[10px] text-orange border border-orange px-3 py-2">{editError}</p>
              )}

              {approvalRequested && (
                <p className="font-mono text-[10px] text-ink border border-mint bg-cream-2 px-3 py-2">
                  Request sent — track the review in the Action Tower.
                </p>
              )}

              {pendingOverride && (
                <div className="border border-orange bg-cream-2 px-4 py-3 flex flex-col gap-3">
                  <p className="text-[13px] text-ink leading-relaxed">{pendingOverride.message}</p>
                  <div className="flex gap-2">
                    {pendingOverride.code === 'OVERTIME_APPROVAL_REQUIRED' ? (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!pendingOverride.workerIdForApproval) return
                          try {
                            await requestOvertime.mutateAsync({
                              worker_id:   pendingOverride.workerIdForApproval,
                              week_start:  pendingOverride.weekStart!,
                              week_end:    pendingOverride.weekEnd!,
                              total_hours: pendingOverride.totalHours!,
                              shift_id: shift.shift_id,
                              edit_scope: requestedScope.current,
                              client_id: requestedScope.current === 'this' ? shift.client.id : clientId,
                              start_time: `${date}T${startTime}:00`,
                              end_time: `${endDate}T${endTime}:00`,
                              is_recurring: shift.is_recurring && requestedScope.current !== 'this',
                              recurrence: shift.is_recurring && requestedScope.current !== 'this' ? buildRecurrencePayload() : undefined,
                              changes: requestedScope.current === 'this' ? {
                                original_date: shift.date, new_start_time: `${date}T${startTime}:00`,
                                new_end_time: `${endDate}T${endTime}:00`, completion_status: completionStatus, notes: notes || undefined,
                              } : requestedScope.current === 'following' ? {
                                occurrence_date: shift.date, new_start_time: `${date}T${startTime}:00`,
                                new_end_time: `${endDate}T${endTime}:00`, worker_id: workerId, client_id: clientId,
                                location: location || undefined, notes: notes || undefined,
                                recurrence_end_date: recurrenceEndDate || undefined,
                                recurrence: recurrenceChanged() ? buildRecurrencePayload() : undefined,
                              } : {
                                start_time: `${date}T${startTime}:00`, end_time: `${endDate}T${endTime}:00`,
                                worker_id: workerId, client_id: clientId, location: location || undefined, notes: notes || undefined,
                                recurrence_end_date: recurrenceEndDate || undefined,
                                recurrence: recurrenceChanged() ? buildRecurrencePayload() : undefined,
                              },
                            })
                            void queryClient.invalidateQueries({ queryKey: ['attention-items'] })
                            void queryClient.invalidateQueries({ queryKey: ['activity'] })
                            setPendingOverride(null)
                            setApprovalRequested(true)
                          } catch {
                            setEditError('Failed to send approval request. Please try again.')
                          }
                        }}
                        className="vd-btn vd-btn-primary"
                      >
                        Notify Manager
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          const fn = pendingOverrideFnRef.current
                          setPendingOverride(null)
                          fn?.()
                        }}
                        className="vd-btn vd-btn-primary"
                      >
                        {pendingOverride.code === 'WORKER_WOULD_ENTER_OVERTIME' ? 'Approve overtime' : 'Schedule anyway'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setPendingOverride(null)}
                      className="vd-btn"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              </div>
            </fieldset>

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
                    className="vd-btn vd-btn-danger w-full"
                  >
                    Cancel Shift
                  </button>
                ) : (
                  <fieldset disabled={busy} className="vd-form-fields">
                    <h3 className="font-serif text-[24px]">Cancel visit</h3>
                    <p className="vd-help">Choose which visits to cancel and record why.</p>
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
                          <label key={value} className="flex items-center gap-2.5 cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-4">
                            <span className={`w-3.5 h-3.5 border border-ink flex items-center justify-center shrink-0 ${cancelScope === value ? 'bg-ink' : ''}`}>
                              {cancelScope === value && <span className="w-1.5 h-1.5 bg-cream block" />}
                            </span>
                            <span className="font-mono text-[10px] text-ink">{label}</span>
                            <input type="radio" name="cancel-scope" className="sr-only" value={value} checked={cancelScope === value} onChange={() => setCancelScope(value)} />
                          </label>
                        ))}
                      </div>
                    )}

                    {/* Reason list */}
                    <div className="flex flex-col gap-1.5">
                      {CANCELLATION_REASONS.map(({ value, label }) => (
                        <label key={value} className="flex items-center gap-2.5 cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-4">
                          <span className={`w-3.5 h-3.5 border border-ink flex items-center justify-center shrink-0 ${cancelReason === value ? 'bg-ink' : ''}`}>
                            {cancelReason === value && <span className="w-1.5 h-1.5 bg-cream block" />}
                          </span>
                          <span className="font-mono text-[10px] text-ink">{label}</span>
                          <input type="radio" name="cancel-reason" className="sr-only" value={value} checked={cancelReason === value} onChange={() => setCancelReason(value)} />
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
                        {visitWriteError(deleteMutation.error)}
                      </p>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowCancelFlow(false)}
                        className="vd-btn flex-1"
                      >
                        Back
                      </button>
                      <button
                        onClick={confirmCancel}
                        disabled={!cancelReason || (cancelReason === 'other' && !cancelReasonOther.trim()) || deleteMutation.isPending}
                        className="vd-btn vd-btn-danger flex-1"
                      >
                        {deleteMutation.isPending ? 'Cancelling…' : 'Confirm Cancel'}
                      </button>
                    </div>
                  </fieldset>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Edit footer ── */}
        {isEditing && (
          <div className="vd-footer">
            <button onClick={handleDiscard} disabled={busy}
              className="vd-btn">
              Discard
            </button>
            <button onClick={handleSave} disabled={busy}
              className="vd-btn vd-btn-primary">
              {saveMutation.isPending ? 'Saving…' : isVisitConnectionError(saveMutation.error) ? 'Retry save' : 'Save Changes'}
            </button>
          </div>
        )}
      </VisitDrawer>

      {showSaveModal && (
        <RecurringActionModal
          mode="edit"
          busy={busy}
          occurrenceLabel={format(start, 'EEEE, MMM d, yyyy')}
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
  const shiftStart = format(new Date(shift.start_time), 'HH:mm')
  const shiftEnd   = format(new Date(shift.end_time),   'HH:mm')

  const [addingEntry, setAddingEntry] = useState(false)
  const [newTime, setNewTime]         = useState(shiftStart)
  const [newContent, setNewContent]   = useState('')

  const { data: note } = useShiftDetailNote(shift.shift_id, shift.date)

  const entries: NoteEntry[] = note?.entries ?? []
  const sorted = [...entries].sort((a, b) => a.time.localeCompare(b.time))

  const saveMutation = useSaveShiftDetailNote(shift.shift_id, shift.date)

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
