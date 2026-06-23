import { useState } from 'react'
import { format, differenceInMinutes } from 'date-fns'
import { Kicker, DateInput, TimeInput } from '@/shared/components/ui'
import { useOvertimeReviewStore } from '@/features/notifications/useOvertimeReviewStore'
import { useApproveOvertime, useRejectOvertime } from '@/features/shifts/hooks/useOvertimeMutations'
import { useMarkResolved } from '@/features/notifications/hooks'
import type { OvertimeNotificationPayload } from '@/features/notifications/api'
import {
  type DayOfWeek,
  type RecurrenceFrequency,
  ORDERED_DAYS,
  DAY_LABELS,
  type OvertimeApproveRequest,
} from '@/features/shifts/api'

type DrawerMode = 'default' | 'edit' | 'reject'

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function nextDay(dateStr: string): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + 1)
  return format(dt, 'yyyy-MM-dd')
}

const labelClass = 'block font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mb-1'

export function OvertimeReviewDrawer() {
  const { notification, close } = useOvertimeReviewStore()
  const [mode, setMode]                   = useState<DrawerMode>('default')
  const [rejectReason, setRejectReason]   = useState('')
  const [error, setError]                 = useState<string | null>(null)

  // Edit state — mirrors CreateShiftDrawer's scheduling fields
  const [editDate, setEditDate]                           = useState('')
  const [editEndDate, setEditEndDate]                     = useState('')
  const [editStartTime, setEditStartTime]                 = useState('')
  const [editEndTime, setEditEndTime]                     = useState('')
  const [editIsRecurring, setEditIsRecurring]             = useState(false)
  const [editFrequency, setEditFrequency]                 = useState<RecurrenceFrequency>('weekly')
  const [editDaysOfWeek, setEditDaysOfWeek]               = useState<DayOfWeek[]>([])
  const [editRecurrenceEndDate, setEditRecurrenceEndDate] = useState('')

  const { mutate: approveOvertime, isPending: approving } = useApproveOvertime()
  const { mutate: rejectOvertime,  isPending: rejecting  } = useRejectOvertime()
  const { mutate: markResolved,    isPending: marking    } = useMarkResolved()

  // Reset the edit form whenever a different notification is opened. Done during
  // render (not in an effect) so the reset doesn't cascade an extra render; the
  // seededId guard makes it run once per notification.
  const [seededId, setSeededId] = useState<string | null>(null)
  if (notification && notification.id !== seededId) {
    setSeededId(notification.id)
    const p = notification.payload as unknown as OvertimeNotificationPayload
    setMode('default')
    setError(null)
    setRejectReason('')
    if (p.start_time) {
      const d = new Date(p.start_time)
      setEditDate(format(d, 'yyyy-MM-dd'))
      setEditStartTime(format(d, 'HH:mm'))
    }
    if (p.end_time) {
      const d = new Date(p.end_time)
      setEditEndDate(format(d, 'yyyy-MM-dd'))
      setEditEndTime(format(d, 'HH:mm'))
    }
    setEditIsRecurring(p.is_recurring ?? false)
    setEditFrequency((p.recurrence?.frequency as RecurrenceFrequency) ?? 'weekly')
    setEditDaysOfWeek((p.recurrence?.days_of_week as DayOfWeek[]) ?? [])
    setEditRecurrenceEndDate(p.recurrence?.recurrence_end_date ?? '')
  }

  if (!notification) return null

  const p          = notification.payload as unknown as OvertimeNotificationPayload
  const isResolved = notification.resolved_at !== null
  const hasFullCtx = !!(p.client_id && p.start_time && p.end_time)

  // Read-only display values
  const startDt      = p.start_time ? new Date(p.start_time) : null
  const endDt        = p.end_time   ? new Date(p.end_time)   : null
  const shiftDate    = startDt ? format(startDt, 'EEE, MMM d, yyyy') : null
  const initStart    = startDt ? format(startDt, 'HH:mm') : ''
  const initEnd      = endDt   ? format(endDt,   'HH:mm') : ''
  const durationMins = startDt && endDt ? differenceInMinutes(endDt, startDt) : 0
  const durationStr  = durationMins >= 60
    ? `${Math.floor(durationMins / 60)}h${durationMins % 60 > 0 ? ` ${durationMins % 60}m` : ''}`
    : `${durationMins}m`

  const workerName = `${notification.about_worker_first_name ?? ''} ${notification.about_worker_last_name ?? ''}`.trim()
  const recurrence = p.recurrence

  function toggleEditDay(day: DayOfWeek) {
    setEditDaysOfWeek((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day])
  }

  function handleApprove() {
    setError(null)
    const req: OvertimeApproveRequest = { notification_id: notification!.id }

    if (mode === 'edit') {
      if (!editDate || !editStartTime || !editEndTime) {
        setError('Please fill in the date and times.')
        return
      }
      if (editIsRecurring && editFrequency === 'weekly' && editDaysOfWeek.length === 0) {
        setError('Select at least one day for weekly recurrence.')
        return
      }
      req.start_time   = `${editDate}T${editStartTime}:00`
      req.end_time     = `${editEndDate || editDate}T${editEndTime}:00`
      req.is_recurring = editIsRecurring
      if (editIsRecurring) {
        req.recurrence = {
          frequency: editFrequency,
          days_of_week: editFrequency === 'weekly' ? editDaysOfWeek : undefined,
          recurrence_end_date: editRecurrenceEndDate || undefined,
        }
      }
    }

    approveOvertime(req, {
      onSuccess: () => close(),
      onError:   (err) => setError(err instanceof Error ? err.message : 'Failed to approve. Try again.'),
    })
  }

  function handleReject() {
    setError(null)
    rejectOvertime(
      { notification_id: notification!.id, reason: rejectReason || undefined },
      { onSuccess: () => close() },
    )
  }

  function handleMarkReviewed() {
    markResolved(notification!.id, { onSuccess: () => close() })
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-ink/20" onClick={close} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] flex-col bg-paper border-l border-ink">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink">
          <Kicker>Overtime Request</Kicker>
          <button onClick={close} className="font-mono text-[18px] text-ink-soft hover:text-ink leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5">

          {isResolved && (
            <p className="font-mono text-[10px] text-ink-soft border border-line-faint px-3 py-2">
              This request has already been resolved.
            </p>
          )}

          {/* Worker */}
          <div>
            <p className={labelClass}>Worker</p>
            <p className="font-mono text-[12px] text-ink font-medium">{workerName}</p>
          </div>

          {/* Client */}
          {hasFullCtx && (
            <div>
              <p className={labelClass}>Client</p>
              <p className="font-mono text-[12px] text-ink">{p.client_name ?? '—'}</p>
            </div>
          )}

          {/* Proposed shift — read-only summary */}
          {hasFullCtx && shiftDate && mode === 'default' && (
            <div className="border border-line-faint bg-cream-2 px-4 py-3 flex flex-col gap-2">
              <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-soft">Proposed Shift</p>
              <p className="font-mono text-[11px] text-ink">{shiftDate}</p>
              <p className="font-mono text-[11px] text-ink">
                {initStart} – {initEnd}
                <span className="ml-2 text-ink-soft">({durationStr})</span>
              </p>
              {recurrence && (
                <p className="font-mono text-[10px] text-ink-soft">
                  Recurring {recurrence.frequency}
                  {recurrence.days_of_week?.length
                    ? ` — ${recurrence.days_of_week.map((d) => DAY_LABELS[d as DayOfWeek] ?? d).join(', ')}`
                    : ''}
                  {recurrence.recurrence_end_date
                    ? ` · ends ${format(parseLocalDate(recurrence.recurrence_end_date), 'MMM d, yyyy')}`
                    : ''}
                </p>
              )}
            </div>
          )}

          {/* Overtime warning */}
          {p.week_start && p.week_end && p.total_hours && (
            <div className="border border-orange bg-cream-2 px-4 py-3">
              <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-orange mb-1.5">Overtime Warning</p>
              <p className="font-mono text-[10px] text-ink leading-relaxed">
                Approving this shift would bring {notification.about_worker_first_name} to{' '}
                <strong>{p.total_hours}h</strong> for the week of{' '}
                {format(parseLocalDate(p.week_start), 'MMM d')}–{format(parseLocalDate(p.week_end), 'MMM d, yyyy')},
                above the 40h threshold.
              </p>
            </div>
          )}

          {/* Requested by + note */}
          <div>
            <p className={labelClass}>Requested by</p>
            <p className="font-mono text-[11px] text-ink">{p.requesting_member_name ?? '—'}</p>
            {p.note && (
              <p className="mt-1.5 font-mono text-[10px] text-ink-soft italic border-l-2 border-line-soft pl-3">
                "{p.note}"
              </p>
            )}
          </div>

          {/* ── Edit mode — full shift editor ────────────────────────────────── */}
          {mode === 'edit' && hasFullCtx && (
            <div className="border-t border-dashed border-line-soft pt-4 flex flex-col gap-4">
              <p className={labelClass}>Edit Shift Details</p>

              {/* Date row — second column appears when overnight */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>{editEndDate !== editDate ? 'Start Date' : 'Date'}</label>
                  <DateInput
                    value={editDate}
                    onChange={(v) => {
                      const wasOvernight = editEndDate === nextDay(editDate)
                      setEditDate(v)
                      setEditEndDate(wasOvernight ? nextDay(v) : v)
                    }}
                    className="w-full"
                  />
                </div>
                {editEndDate !== editDate && (
                  <div>
                    <label className={labelClass}>End Date</label>
                    <DateInput value={editEndDate} min={editDate} onChange={setEditEndDate} className="w-full" />
                  </div>
                )}
              </div>

              {/* Times */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Start Time</label>
                  <TimeInput
                    value={editStartTime}
                    className="w-full"
                    onChange={(v) => {
                      setEditStartTime(v)
                      if (v && editEndTime && editEndTime <= v && editEndDate === editDate) setEditEndDate(nextDay(editDate))
                      if (v && editEndTime && editEndTime > v  && editEndDate === nextDay(editDate)) setEditEndDate(editDate)
                    }}
                  />
                </div>
                <div>
                  <label className={labelClass}>End Time</label>
                  <TimeInput
                    value={editEndTime}
                    className="w-full"
                    onChange={(v) => {
                      setEditEndTime(v)
                      if (v && editStartTime && v <= editStartTime && editEndDate === editDate) setEditEndDate(nextDay(editDate))
                      if (v && editStartTime && v > editStartTime  && editEndDate === nextDay(editDate)) setEditEndDate(editDate)
                    }}
                  />
                </div>
              </div>

              {/* Recurrence */}
              <div className="border-t border-dashed border-line-soft pt-3 flex flex-col gap-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={editIsRecurring}
                    onClick={() => setEditIsRecurring((v) => !v)}
                    className={`relative inline-flex h-5 w-9 items-center border transition-colors ${
                      editIsRecurring ? 'bg-ink border-ink' : 'bg-cream-2 border-line-soft'
                    }`}
                  >
                    <span className={`inline-block h-3 w-3 bg-cream transition-transform ${editIsRecurring ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                  <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-ink-soft">
                    Repeat this shift
                  </span>
                </label>

                {editIsRecurring && (
                  <>
                    {/* Frequency */}
                    <div>
                      <p className={labelClass}>Frequency</p>
                      <div className="flex gap-2 mt-1">
                        {(['daily', 'weekly'] as RecurrenceFrequency[]).map((f) => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => setEditFrequency(f)}
                            className={`px-4 py-2 font-mono text-[10px] tracking-[0.05em] uppercase border transition-colors ${
                              editFrequency === f ? 'bg-ink text-cream border-ink' : 'border-ink text-ink-soft hover:text-ink'
                            }`}
                          >
                            {f === 'daily' ? 'Daily' : 'Weekly'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Days of week */}
                    {editFrequency === 'weekly' && (
                      <div>
                        <p className={labelClass}>Days</p>
                        <div className="flex gap-1.5 mt-1 flex-wrap">
                          {ORDERED_DAYS.map((day) => (
                            <button
                              key={day}
                              type="button"
                              onClick={() => toggleEditDay(day)}
                              className={`h-8 w-9 font-mono text-[9px] tracking-[0.05em] uppercase border transition-colors ${
                                editDaysOfWeek.includes(day)
                                  ? 'bg-ink text-cream border-ink'
                                  : 'border-ink text-ink-soft hover:text-ink'
                              }`}
                            >
                              {DAY_LABELS[day]}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recurrence end date */}
                    <div>
                      <label className={labelClass}>
                        Series End Date <span className="normal-case text-muted">(optional)</span>
                      </label>
                      <DateInput value={editRecurrenceEndDate} onChange={setEditRecurrenceEndDate} className="w-full" />
                      <p className="mt-1 font-mono text-[9px] text-muted">Leave blank to repeat indefinitely.</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Reject reason */}
          {mode === 'reject' && (
            <div className="border-t border-dashed border-line-soft pt-4 flex flex-col gap-3">
              <p className={labelClass}>Reason (optional)</p>
              <textarea
                className="w-full bg-cream border border-ink px-3 py-2 font-mono text-[11px] text-ink focus:outline-none focus:ring-1 focus:ring-ink resize-none"
                rows={3}
                placeholder="Let the requester know why…"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
          )}

          {error && (
            <p className="font-mono text-[10px] text-orange border border-orange px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        {isResolved ? (
          <div className="border-t border-ink px-6 py-4">
            <button
              onClick={close}
              className="w-full border border-ink py-2 font-mono text-[10px] tracking-[0.08em] uppercase text-ink-soft hover:text-ink transition-colors"
            >
              Close
            </button>
          </div>
        ) : hasFullCtx ? (
          <div className="border-t border-ink px-6 py-4 flex flex-col gap-2">
            {mode === 'default' && (
              <>
                <button
                  onClick={handleApprove}
                  disabled={approving}
                  className="w-full bg-ink text-cream py-2.5 font-mono text-[10px] tracking-[0.08em] uppercase hover:opacity-80 disabled:opacity-40 transition-opacity"
                >
                  {approving ? 'Approving…' : 'Approve'}
                </button>
                <button
                  onClick={() => setMode('edit')}
                  className="w-full border border-ink py-2.5 font-mono text-[10px] tracking-[0.08em] uppercase text-ink hover:bg-cream-2 transition-colors"
                >
                  Approve with edits
                </button>
                <button
                  onClick={() => setMode('reject')}
                  className="w-full border border-orange py-2.5 font-mono text-[10px] tracking-[0.08em] uppercase text-orange hover:bg-orange/5 transition-colors"
                >
                  Reject
                </button>
              </>
            )}
            {mode === 'edit' && (
              <div className="flex gap-2">
                <button
                  onClick={handleApprove}
                  disabled={approving}
                  className="flex-1 bg-ink text-cream py-2.5 font-mono text-[10px] tracking-[0.08em] uppercase hover:opacity-80 disabled:opacity-40 transition-opacity"
                >
                  {approving ? 'Approving…' : 'Approve'}
                </button>
                <button
                  onClick={() => setMode('default')}
                  className="border border-ink px-4 py-2.5 font-mono text-[10px] tracking-[0.08em] uppercase text-ink-soft hover:text-ink transition-colors"
                >
                  Back
                </button>
              </div>
            )}
            {mode === 'reject' && (
              <div className="flex gap-2">
                <button
                  onClick={handleReject}
                  disabled={rejecting}
                  className="flex-1 bg-orange text-white py-2.5 font-mono text-[10px] tracking-[0.08em] uppercase hover:opacity-80 disabled:opacity-40 transition-opacity"
                >
                  {rejecting ? 'Rejecting…' : 'Confirm Reject'}
                </button>
                <button
                  onClick={() => setMode('default')}
                  className="border border-ink px-4 py-2.5 font-mono text-[10px] tracking-[0.08em] uppercase text-ink-soft hover:text-ink transition-colors"
                >
                  Back
                </button>
              </div>
            )}
          </div>
        ) : (
          /* No full context — ShiftDetailDrawer case */
          <div className="border-t border-ink px-6 py-4 flex flex-col gap-3">
            <p className="font-mono text-[10px] text-ink-soft leading-relaxed">
              To approve, find the shift in the worker's schedule and save it directly — as a manager or owner you can override the overtime check.
            </p>
            <button
              onClick={handleMarkReviewed}
              disabled={marking}
              className="w-full bg-ink text-cream py-2.5 font-mono text-[10px] tracking-[0.08em] uppercase hover:opacity-80 disabled:opacity-40 transition-opacity"
            >
              {marking ? 'Marking…' : 'Mark as Reviewed'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
