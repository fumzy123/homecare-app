import { useState } from 'react'
import { X, Clock, RefreshCw, AlertTriangle, MapPin } from 'lucide-react'
import { format, differenceInMinutes } from 'date-fns'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { shiftsApi, type ShiftOccurrence } from '@/features/shifts/api'

const COMPLETION_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  scheduled:   { label: 'Scheduled',   className: 'bg-blue-50 text-blue-700' },
  in_progress: { label: 'In Progress', className: 'bg-yellow-50 text-yellow-700' },
  completed:   { label: 'Completed',   className: 'bg-green-50 text-green-700' },
  no_show:     { label: 'No Show',     className: 'bg-red-50 text-red-600' },
  cancelled:   { label: 'Cancelled',   className: 'bg-gray-100 text-gray-500' },
}

function formatDuration(start: Date, end: Date): string {
  const mins = differenceInMinutes(end, start)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

interface ShiftDetailDrawerProps {
  shift: ShiftOccurrence
  onClose: () => void
}

export function ShiftDetailDrawer({ shift, onClose }: ShiftDetailDrawerProps) {
  const queryClient = useQueryClient()
  const [cancelConfirm, setCancelConfirm] = useState(false)

  const start = new Date(shift.start_time)
  const end = new Date(shift.end_time)
  const status = COMPLETION_STATUS_LABELS[shift.completion_status] ?? {
    label: shift.completion_status,
    className: 'bg-gray-100 text-gray-500',
  }

  const cancelMutation = useMutation({
    mutationFn: () => shiftsApi.cancelShift(shift.shift_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] })
      onClose()
    },
  })

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">Shift Details</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">

          {/* Date & Time */}
          <div className="rounded-lg bg-gray-50 px-4 py-4">
            <p className="text-lg font-semibold text-gray-900">
              {format(start, 'EEEE, MMMM d, yyyy')}
            </p>
            <div className="mt-1 flex items-center gap-2 text-sm text-gray-600">
              <Clock size={13} className="text-gray-400" />
              <span>
                {format(start, 'h:mm a')} – {format(end, 'h:mm a')}
              </span>
              <span className="text-gray-400">·</span>
              <span className="text-gray-500">{formatDuration(start, end)}</span>
            </div>
          </div>

          {/* Location */}
          {shift.location && (
            <div className="flex items-start gap-2 text-sm text-gray-700">
              <MapPin size={14} className="mt-0.5 shrink-0 text-gray-400" />
              <span>{shift.location}</span>
            </div>
          )}

          {/* Status & Recurring badges */}
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}>
              {status.label}
            </span>
            {shift.is_recurring && (
              <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-600">
                <RefreshCw size={10} />
                Recurring
              </span>
            )}
            {shift.is_modification && (
              <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-600">
                Modified
              </span>
            )}
          </div>

          {/* Worker */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Worker</p>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white">
                {shift.worker.first_name[0]}{shift.worker.last_name[0]}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {shift.worker.first_name} {shift.worker.last_name}
                </p>
                <p className="text-xs text-gray-500">{shift.worker.email}</p>
              </div>
            </div>
          </div>

          {/* Client */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Client</p>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
                {shift.client.first_name[0]}{shift.client.last_name[0]}
              </div>
              <p className="text-sm font-medium text-gray-900">
                {shift.client.first_name} {shift.client.last_name}
              </p>
            </div>
          </div>

          {/* Notes */}
          {shift.notes && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Notes</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{shift.notes}</p>
            </div>
          )}

          {/* Cancel */}
          <div className="mt-auto border-t border-gray-100 pt-5">
            {shift.is_recurring && !cancelConfirm && (
              <div className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                <span>Cancelling a recurring shift removes the entire schedule, not just this occurrence.</span>
              </div>
            )}

            {!cancelConfirm ? (
              <button
                onClick={() => setCancelConfirm(true)}
                className="w-full rounded-md border border-red-200 bg-white py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                Cancel Shift
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-center text-sm text-gray-700">
                  {shift.is_recurring
                    ? 'Cancel the entire recurring schedule?'
                    : 'Cancel this shift?'}
                </p>
                <button
                  onClick={() => cancelMutation.mutate()}
                  disabled={cancelMutation.isPending}
                  className="w-full rounded-md bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {cancelMutation.isPending ? 'Cancelling…' : 'Yes, cancel it'}
                </button>
                <button
                  onClick={() => setCancelConfirm(false)}
                  className="w-full rounded-md border border-gray-300 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Keep Shift
                </button>
                {cancelMutation.isError && (
                  <p className="text-center text-xs text-red-500">
                    {cancelMutation.error instanceof Error
                      ? cancelMutation.error.message
                      : 'Something went wrong'}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
