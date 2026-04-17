import { useForm } from '@tanstack/react-form'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { X } from 'lucide-react'
import { z } from 'zod'
import { format } from 'date-fns'
import { shiftsApi, type DayOfWeek, type RecurrenceFrequency, ORDERED_DAYS, DAY_LABELS } from '@/features/shifts/api'
import { workersApi } from '@/features/workers/api'
import { clientsApi } from '@/features/clients/api'

const schema = z.object({
  worker_id: z.string().min(1, 'Select a worker'),
  client_id: z.string().min(1, 'Select a client'),
  date: z.string().min(1, 'Required'),
  start_time: z.string().min(1, 'Required'),
  end_time: z.string().min(1, 'Required'),
  notes: z.string().optional(),
})

export interface PendingShiftInfo {
  start: Date
  end: Date
  title: string
}

interface CreateShiftDrawerProps {
  initialDate?: Date | null
  initialEndDate?: Date | null
  onFormChange?: (info: PendingShiftInfo) => void
  onClose: () => void
  onSuccess: () => void
}

function validate<T>(shape: z.ZodType<T>, value: T) {
  const r = shape.safeParse(value)
  return r.success ? undefined : r.error.issues[0].message
}

function FieldError({ error }: { error: unknown }) {
  if (!error) return null
  return <p className="mt-1 text-xs text-red-500">{error as string}</p>
}

const inputClass =
  'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400'
const labelClass = 'block text-sm font-medium text-gray-700'

export function CreateShiftDrawer({ initialDate, initialEndDate, onFormChange, onClose, onSuccess }: CreateShiftDrawerProps) {
  const [serverError, setServerError] = useState<string | null>(null)

  // Fields kept outside TanStack Form for simplicity
  const [location, setLocation] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('weekly')
  const [daysOfWeek, setDaysOfWeek] = useState<DayOfWeek[]>([])
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('')

  const { data: workers = [] } = useQuery({
    queryKey: ['workers'],
    queryFn: workersApi.listWorkers,
  })

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientsApi.listClients(),
  })

  const defaultDate = initialDate ? format(initialDate, 'yyyy-MM-dd') : ''
  const defaultStartTime = initialDate ? format(initialDate, 'HH:mm') : '09:00'
  const defaultEndTime = initialEndDate ? format(initialEndDate, 'HH:mm') : '17:00'

  function notifyFormChange(
    date: string,
    startTime: string,
    endTime: string,
    workerId: string,
    clientId: string,
  ) {
    if (!onFormChange || !date || !startTime || !endTime) return
    const start = new Date(`${date}T${startTime}`)
    const end = new Date(`${date}T${endTime}`)
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return
    const worker = workers.find((w) => w.id === workerId)
    const client = clients.find((c) => c.id === clientId)
    let title = 'New Shift'
    if (worker && client) title = `${worker.first_name} · ${client.first_name} ${client.last_name}`
    else if (worker) title = `${worker.first_name} · ?`
    else if (client) title = `? · ${client.first_name} ${client.last_name}`
    onFormChange({ start, end, title })
  }

  const form = useForm({
    defaultValues: {
      worker_id: '',
      client_id: '',
      date: defaultDate,
      start_time: defaultStartTime,
      end_time: defaultEndTime,
      notes: '',
    },
    onSubmit: async ({ value }) => {
      setServerError(null)

      // Validate recurrence
      if (isRecurring && frequency === 'weekly' && daysOfWeek.length === 0) {
        setServerError('Select at least one day for weekly recurrence.')
        return
      }

      // Combine date + time → ISO datetime
      const startISO = new Date(`${value.date}T${value.start_time}`).toISOString()
      const endISO = new Date(`${value.date}T${value.end_time}`).toISOString()

      if (new Date(endISO) <= new Date(startISO)) {
        setServerError('End time must be after start time.')
        return
      }

      try {
        await shiftsApi.createShift({
          worker_id: value.worker_id,
          client_id: value.client_id,
          start_time: startISO,
          end_time: endISO,
          location: location || undefined,
          notes: value.notes || undefined,
          recurrence: isRecurring
            ? {
                frequency,
                days_of_week: frequency === 'weekly' ? daysOfWeek : undefined,
                recurrence_end_date: recurrenceEndDate || undefined,
              }
            : undefined,
        })
        onSuccess()
        onClose()
      } catch (err: unknown) {
        setServerError(err instanceof Error ? err.message : 'Something went wrong')
      }
    },
  })

  function toggleDay(day: DayOfWeek) {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">New Shift</h2>
          <button onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {/* Form body */}
        <form
          className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4"
          onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}
        >
          {/* Worker */}
          <form.Field
            name="worker_id"
            validators={{ onChange: ({ value }) => validate(schema.shape.worker_id, value) }}
          >
            {(field) => (
              <div>
                <label className={labelClass}>Worker *</label>
                <select
                  className={inputClass}
                  value={field.state.value}
                  onChange={(e) => {
                    field.handleChange(e.target.value)
                    notifyFormChange(form.state.values.date, form.state.values.start_time, form.state.values.end_time, e.target.value, form.state.values.client_id)
                  }}
                  onBlur={field.handleBlur}
                >
                  <option value="">Select a worker…</option>
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.first_name} {w.last_name}
                    </option>
                  ))}
                </select>
                <FieldError error={field.state.meta.errors[0]} />
              </div>
            )}
          </form.Field>

          {/* Client */}
          <form.Field
            name="client_id"
            validators={{ onChange: ({ value }) => validate(schema.shape.client_id, value) }}
          >
            {(field) => (
              <div>
                <label className={labelClass}>Client *</label>
                <select
                  className={inputClass}
                  value={field.state.value}
                  onChange={(e) => {
                    field.handleChange(e.target.value)
                    const selected = clients.find((c) => c.id === e.target.value)
                    if (selected) {
                      setLocation(
                        `${selected.street}, ${selected.city}, ${selected.province} ${selected.postal_code}`
                      )
                    } else {
                      setLocation('')
                    }
                    notifyFormChange(form.state.values.date, form.state.values.start_time, form.state.values.end_time, form.state.values.worker_id, e.target.value)
                  }}
                  onBlur={field.handleBlur}
                >
                  <option value="">Select a client…</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} {c.last_name}
                    </option>
                  ))}
                </select>
                <FieldError error={field.state.meta.errors[0]} />
              </div>
            )}
          </form.Field>

          {/* Location — auto-filled from client, editable */}
          <div>
            <label className={labelClass}>Location</label>
            <input
              className={inputClass}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Address will fill when you select a client"
            />
            <p className="mt-1 text-xs text-gray-400">
              Defaults to the client's address. Edit to override.
            </p>
          </div>

          {/* Date */}
          <form.Field
            name="date"
            validators={{ onChange: ({ value }) => validate(schema.shape.date, value) }}
          >
            {(field) => (
              <div>
                <label className={labelClass}>Date *</label>
                <input
                  type="date"
                  className={inputClass}
                  value={field.state.value}
                  onChange={(e) => {
                    field.handleChange(e.target.value)
                    notifyFormChange(e.target.value, form.state.values.start_time, form.state.values.end_time, form.state.values.worker_id, form.state.values.client_id)
                  }}
                  onBlur={field.handleBlur}
                />
                <FieldError error={field.state.meta.errors[0]} />
              </div>
            )}
          </form.Field>

          {/* Start + End time */}
          <div className="flex gap-3">
            <form.Field
              name="start_time"
              validators={{ onChange: ({ value }) => validate(schema.shape.start_time, value) }}
            >
              {(field) => (
                <div className="flex-1">
                  <label className={labelClass}>Start Time *</label>
                  <input
                    type="time"
                    className={inputClass}
                    value={field.state.value}
                    onChange={(e) => {
                      field.handleChange(e.target.value)
                      notifyFormChange(form.state.values.date, e.target.value, form.state.values.end_time, form.state.values.worker_id, form.state.values.client_id)
                    }}
                    onBlur={field.handleBlur}
                  />
                  <FieldError error={field.state.meta.errors[0]} />
                </div>
              )}
            </form.Field>

            <form.Field
              name="end_time"
              validators={{ onChange: ({ value }) => validate(schema.shape.end_time, value) }}
            >
              {(field) => (
                <div className="flex-1">
                  <label className={labelClass}>End Time *</label>
                  <input
                    type="time"
                    className={inputClass}
                    value={field.state.value}
                    onChange={(e) => {
                      field.handleChange(e.target.value)
                      notifyFormChange(form.state.values.date, form.state.values.start_time, e.target.value, form.state.values.worker_id, form.state.values.client_id)
                    }}
                    onBlur={field.handleBlur}
                  />
                  <FieldError error={field.state.meta.errors[0]} />
                </div>
              )}
            </form.Field>
          </div>

          {/* Notes */}
          <form.Field name="notes">
            {(field) => (
              <div>
                <label className={labelClass}>Notes</label>
                <textarea
                  className={`${inputClass} resize-none`}
                  rows={2}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            )}
          </form.Field>

          {/* ── Recurrence ── */}
          <div className="border-t border-gray-100 pt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
              />
              <span className="text-sm font-medium text-gray-700">Repeat this shift</span>
            </label>

            {isRecurring && (
              <div className="mt-4 flex flex-col gap-4">
                {/* Frequency */}
                <div>
                  <label className={labelClass}>Frequency</label>
                  <div className="mt-1 flex gap-3">
                    {(['daily', 'weekly'] as RecurrenceFrequency[]).map((f) => (
                      <label key={f} className="flex items-center gap-1.5 cursor-pointer text-sm text-gray-700">
                        <input
                          type="radio"
                          name="frequency"
                          value={f}
                          checked={frequency === f}
                          onChange={() => setFrequency(f)}
                          className="h-4 w-4 border-gray-300"
                        />
                        {f === 'daily' ? 'Daily' : 'Weekly'}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Days of week (only for weekly) */}
                {frequency === 'weekly' && (
                  <div>
                    <label className={labelClass}>Days *</label>
                    <div className="mt-2 flex gap-2">
                      {ORDERED_DAYS.map((day) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleDay(day)}
                          className={`h-8 w-10 rounded-md text-xs font-medium transition-colors ${
                            daysOfWeek.includes(day)
                              ? 'bg-gray-900 text-white'
                              : 'border border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
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
                  <label className={labelClass}>End Date</label>
                  <input
                    type="date"
                    className={inputClass}
                    value={recurrenceEndDate}
                    onChange={(e) => setRecurrenceEndDate(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-gray-400">Leave blank to repeat indefinitely.</p>
                </div>
              </div>
            )}
          </div>

          {serverError && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{serverError}</p>
          )}

          <div className="h-2" />
        </form>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(isSubmitting) => (
              <button
                type="button"
                onClick={() => form.handleSubmit()}
                disabled={isSubmitting}
                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving…' : isRecurring ? 'Create Recurring Shift' : 'Create Shift'}
              </button>
            )}
          </form.Subscribe>
        </div>
      </div>
    </>
  )
}
