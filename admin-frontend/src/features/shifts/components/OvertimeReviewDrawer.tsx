import { useState, useEffect } from 'react'
import { format, differenceInMinutes, addDays } from 'date-fns'
import { Kicker, TimeInput } from '@/shared/components/ui'
import { useOvertimeReviewStore } from '@/features/notifications/useOvertimeReviewStore'
import { useApproveOvertime, useRejectOvertime } from '@/features/shifts/hooks/useOvertimeMutations'
import { useMarkResolved } from '@/features/notifications/hooks'
import type { OvertimeNotificationPayload } from '@/features/notifications/api'

type DrawerMode = 'default' | 'edit' | 'reject'

const DAY_LABELS: Record<string, string> = {
  MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat', SU: 'Sun',
}

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const labelClass = 'block font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mb-1'

export function OvertimeReviewDrawer() {
  const { notification, close } = useOvertimeReviewStore()
  const [mode, setMode]               = useState<DrawerMode>('default')
  const [editStartTime, setEditStartTime] = useState('')
  const [editEndTime, setEditEndTime]     = useState('')
  const [rejectReason, setRejectReason]   = useState('')
  const [error, setError]             = useState<string | null>(null)

  const { mutate: approveOvertime, isPending: approving } = useApproveOvertime()
  const { mutate: rejectOvertime,  isPending: rejecting  } = useRejectOvertime()
  const { mutate: markResolved,    isPending: marking    } = useMarkResolved()

  useEffect(() => {
    if (!notification) return
    const p = notification.payload as OvertimeNotificationPayload
    setMode('default')
    setError(null)
    setRejectReason('')
    if (p.start_time) setEditStartTime(format(new Date(p.start_time), 'HH:mm'))
    if (p.end_time)   setEditEndTime(format(new Date(p.end_time), 'HH:mm'))
  }, [notification?.id])

  if (!notification) return null

  const p            = notification.payload as OvertimeNotificationPayload
  const isResolved   = notification.resolved_at !== null
  const hasFullCtx   = !!(p.client_id && p.start_time && p.end_time)

  // Parse shift times
  const startDt      = p.start_time ? new Date(p.start_time) : null
  const endDt        = p.end_time   ? new Date(p.end_time)   : null
  const shiftDate    = startDt ? format(startDt, 'EEE, MMM d, yyyy') : null
  const initStart    = startDt ? format(startDt, 'HH:mm') : ''
  const initEnd      = endDt   ? format(endDt,   'HH:mm') : ''
  const durationMins = startDt && endDt ? differenceInMinutes(endDt, startDt) : 0
  const durationStr  = durationMins >= 60
    ? `${Math.floor(durationMins / 60)}h${durationMins % 60 > 0 ? ` ${durationMins % 60}m` : ''}`
    : `${durationMins}m`

  const workerName   = `${notification.worker_first_name} ${notification.worker_last_name}`
  const recurrence   = p.recurrence

  function handleApprove() {
    setError(null)
    const req: { notification_id: string; start_time?: string; end_time?: string } = {
      notification_id: notification!.id,
    }
    if (mode === 'edit' && startDt) {
      const dateStr    = format(startDt, 'yyyy-MM-dd')
      const isOvernight = editEndTime < editStartTime
      const endDateStr = isOvernight ? format(addDays(startDt, 1), 'yyyy-MM-dd') : dateStr
      req.start_time = `${dateStr}T${editStartTime}:00`
      req.end_time   = `${endDateStr}T${editEndTime}:00`
    }
    approveOvertime(req, {
      onSuccess: () => close(),
      onError: (err) => setError(err instanceof Error ? err.message : 'Failed to approve. Try again.'),
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
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[400px] flex-col bg-paper border-l border-ink">

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
            <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-soft mb-1">Worker</p>
            <p className="font-mono text-[12px] text-ink font-medium">{workerName}</p>
          </div>

          {/* Client */}
          {hasFullCtx && (
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-soft mb-1">Client</p>
              <p className="font-mono text-[12px] text-ink">{p.client_name ?? '—'}</p>
            </div>
          )}

          {/* Proposed shift */}
          {hasFullCtx && shiftDate && (
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
                    ? ` — ${recurrence.days_of_week.map((d) => DAY_LABELS[d] ?? d).join(', ')}`
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
                Approving this shift would bring {notification.worker_first_name} to{' '}
                <strong>{p.total_hours}h</strong> for the week of{' '}
                {format(parseLocalDate(p.week_start), 'MMM d')}–{format(parseLocalDate(p.week_end), 'MMM d, yyyy')},
                above the 40h threshold.
              </p>
            </div>
          )}

          {/* Requested by + note */}
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-soft mb-1">Requested by</p>
            <p className="font-mono text-[11px] text-ink">{p.requesting_member_name ?? '—'}</p>
            {p.note && (
              <p className="mt-1.5 font-mono text-[10px] text-ink-soft italic border-l-2 border-line-soft pl-3">
                "{p.note}"
              </p>
            )}
          </div>

          {/* Adjust times (edit mode) */}
          {mode === 'edit' && hasFullCtx && (
            <div className="border-t border-dashed border-line-soft pt-4 flex flex-col gap-3">
              <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-soft">Adjust Times</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Start Time</label>
                  <TimeInput value={editStartTime} onChange={setEditStartTime} className="w-full" />
                </div>
                <div>
                  <label className={labelClass}>End Time</label>
                  <TimeInput value={editEndTime} onChange={setEditEndTime} className="w-full" />
                </div>
              </div>
            </div>
          )}

          {/* Reject reason (reject mode) */}
          {mode === 'reject' && (
            <div className="border-t border-dashed border-line-soft pt-4 flex flex-col gap-3">
              <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-soft">Reason (optional)</p>
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
