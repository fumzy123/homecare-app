import { useState } from 'react'
import { X, Clock, RefreshCw, AlertTriangle, MapPin, Pencil } from 'lucide-react'
import { format, differenceInMinutes } from 'date-fns'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { shiftsApi, type ShiftOccurrence } from '@/features/shifts/api'
import { workersApi } from '@/features/workers/api'
import { clientsApi } from '@/features/clients/api'

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

const inputClass =
  'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400'
const labelClass = 'block text-xs font-medium text-gray-600'

interface ShiftDetailDrawerProps {
  shift: ShiftOccurrence
  onClose: () => void
}

export function ShiftDetailDrawer({ shift, onClose }: ShiftDetailDrawerProps) {
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [cancelConfirm, setCancelConfirm] = useState(false)

  const start = new Date(shift.start_time)
  const end = new Date(shift.end_time)
  const status = COMPLETION_STATUS_LABELS[shift.completion_status] ?? {
    label: shift.completion_status,
    className: 'bg-gray-100 text-gray-500',
  }

  // ── Edit state ──
  const [workerId, setWorkerId] = useState(shift.worker.id)
  const [clientId, setClientId] = useState(shift.client.id)
  const [date, setDate] = useState(format(start, 'yyyy-MM-dd'))
  const [startTime, setStartTime] = useState(format(start, 'HH:mm'))
  const [endTime, setEndTime] = useState(format(end, 'HH:mm'))
  const [location, setLocation] = useState(shift.location ?? '')
  const [notes, setNotes] = useState(shift.notes ?? '')
  const [editError, setEditError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Only needed when editing a non-recurring shift (recurring edits don't change worker/client)
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

  const updateMutation = useMutation({
    mutationFn: () => {
      const startISO = new Date(`${date}T${startTime}`).toISOString()
      const endISO = new Date(`${date}T${endTime}`).toISOString()

      if (shift.is_recurring) {
        // Recurring occurrence → create or update a modification for just this occurrence
        const originalDate = shift.date  // YYYY-MM-DD identifying which occurrence
        if (shift.is_modification) {
          // Modification already exists → update it
          return shiftsApi.updateModification(shift.shift_id, originalDate, {
            new_start_time: startISO,
            new_end_time: endISO,
            notes: notes || undefined,
          })
        } else {
          // No modification yet → create one
          return shiftsApi.createModification(shift.shift_id, {
            original_date: originalDate,
            new_start_time: startISO,
            new_end_time: endISO,
            notes: notes || undefined,
          })
        }
      } else {
        // Single shift → update the master record
        return shiftsApi.updateShift(shift.shift_id, {
          worker_id: workerId,
          client_id: clientId,
          start_time: startISO,
          end_time: endISO,
          location: location || undefined,
          notes: notes || undefined,
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] })
      setSaved(true)
      setIsEditing(false)
      setTimeout(() => setSaved(false), 2500)
    },
    onError: (err) => {
      setEditError(err instanceof Error ? err.message : 'Something went wrong')
    },
  })

  const cancelMutation = useMutation({
    mutationFn: () => shiftsApi.cancelShift(shift.shift_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] })
      onClose()
    },
  })

  function handleSave() {
    setEditError(null)
    const s = new Date(`${date}T${startTime}`)
    const e = new Date(`${date}T${endTime}`)
    if (e <= s) {
      setEditError('End time must be after start time.')
      return
    }
    updateMutation.mutate()
  }

  function handleDiscardEdit() {
    // Reset fields back to original
    setWorkerId(shift.worker.id)
    setClientId(shift.client.id)
    setDate(format(start, 'yyyy-MM-dd'))
    setStartTime(format(start, 'HH:mm'))
    setEndTime(format(end, 'HH:mm'))
    setLocation(shift.location ?? '')
    setNotes(shift.notes ?? '')
    setEditError(null)
    setIsEditing(false)
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">
            {isEditing ? 'Edit Shift' : 'Shift Details'}
          </h2>
          <div className="flex items-center gap-1">
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                title="Edit shift"
                className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <Pencil size={15} />
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">

          {isEditing ? (
            /* ── Edit mode ── */
            <>
              {shift.is_recurring ? (
                <div className="flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2.5 text-xs text-blue-700">
                  <RefreshCw size={13} className="mt-0.5 shrink-0" />
                  <span>
                    Only this occurrence will be changed — the rest of the schedule is unaffected.
                  </span>
                </div>
              ) : null}

              {/* Worker — master field, only editable on non-recurring shifts */}
              {!shift.is_recurring && (
                <div>
                  <label className={labelClass}>Worker</label>
                  <select
                    className={inputClass}
                    value={workerId}
                    onChange={(e) => setWorkerId(e.target.value)}
                  >
                    {workers.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.first_name} {w.last_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Client — master field, only editable on non-recurring shifts */}
              {!shift.is_recurring && (
                <div>
                  <label className={labelClass}>Client</label>
                  <select
                    className={inputClass}
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                  >
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.first_name} {c.last_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Date */}
              <div>
                <label className={labelClass}>Date</label>
                <input
                  type="date"
                  className={inputClass}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              {/* Start / End time */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className={labelClass}>Start Time</label>
                  <input
                    type="time"
                    className={inputClass}
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <label className={labelClass}>End Time</label>
                  <input
                    type="time"
                    className={inputClass}
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>

              {/* Location — master field, only editable on non-recurring shifts */}
              {!shift.is_recurring && (
                <div>
                  <label className={labelClass}>Location</label>
                  <input
                    className={inputClass}
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Address"
                  />
                </div>
              )}

              {/* Notes */}
              <div>
                <label className={labelClass}>Notes</label>
                <textarea
                  className={`${inputClass} resize-none`}
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional"
                />
              </div>

              {editError && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{editError}</p>
              )}
            </>
          ) : (
            /* ── View mode ── */
            <>
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
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Notes</p>
                {shift.notes
                  ? <p className="text-sm text-gray-700 whitespace-pre-wrap">{shift.notes}</p>
                  : <p className="text-sm text-gray-400 italic">No notes</p>
                }
              </div>

              {saved && (
                <p className="text-center text-sm font-medium text-green-600">Changes saved</p>
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
            </>
          )}
        </div>

        {/* Edit mode footer */}
        {isEditing && (
          <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={handleDiscardEdit}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
            >
              {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
