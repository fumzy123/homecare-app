import { useForm } from '@tanstack/react-form'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { z } from 'zod'
import { format } from 'date-fns'
import { shiftsApi, type DayOfWeek, type RecurrenceFrequency, ORDERED_DAYS, DAY_LABELS } from '@/features/shifts/api'
import { workersApi } from '@/features/workers/api'
import { clientsApi } from '@/features/clients/api'
import { Kicker, DateInput } from '@/shared/components/ui'

function nextDay(date: string): string {
  const d = new Date(`${date}T00:00`)
  d.setDate(d.getDate() + 1)
  return format(d, 'yyyy-MM-dd')
}

const schema = z.object({
  worker_id: z.string().min(1, 'Select a worker'),
  client_id: z.string().min(1, 'Select a client'),
  date:       z.string().min(1, 'Required'),
  start_time: z.string().min(1, 'Required'),
  end_time:   z.string().min(1, 'Required'),
  notes:      z.string().optional(),
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
  return <p className="mt-1 font-mono text-[10px] text-orange">{error as string}</p>
}

const labelClass  = 'block font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mb-1'
const inputClass  = 'w-full bg-cream border border-ink px-3 py-2 font-mono text-[11px] text-ink focus:outline-none focus:ring-1 focus:ring-ink'
const selectClass = `${inputClass} appearance-none`

export function CreateShiftDrawer({ initialDate, initialEndDate, onFormChange, onClose, onSuccess }: CreateShiftDrawerProps) {
  const defaultDate      = initialDate    ? format(initialDate,    'yyyy-MM-dd') : ''
  const defaultStartTime = initialDate    ? format(initialDate,    'HH:mm')      : '09:00'
  const defaultEndTime   = initialEndDate ? format(initialEndDate, 'HH:mm')      : '17:00'

  const [serverError, setServerError] = useState<string | null>(null)
  const [endDate, setEndDate]               = useState(defaultDate)
  const [location, setLocation]             = useState('')
  const [isRecurring, setIsRecurring]       = useState(false)
  const [frequency, setFrequency]           = useState<RecurrenceFrequency>('weekly')
  const [daysOfWeek, setDaysOfWeek]         = useState<DayOfWeek[]>([])
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('')

  const { data: workers = [] } = useQuery({ queryKey: ['workers'], queryFn: workersApi.listWorkers })
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => clientsApi.listClients() })

  function notifyFormChange(startDate: string, startTime: string, endD: string, endTime: string, workerId: string, clientId: string) {
    if (!onFormChange || !startDate || !startTime || !endTime) return
    const start = new Date(`${startDate}T${startTime}`)
    const end   = new Date(`${endD}T${endTime}`)
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
      worker_id:  '',
      client_id:  '',
      date:       defaultDate,
      start_time: defaultStartTime,
      end_time:   defaultEndTime,
      notes:      '',
    },
    onSubmit: async ({ value }) => {
      setServerError(null)
      if (isRecurring && frequency === 'weekly' && daysOfWeek.length === 0) {
        setServerError('Select at least one day for weekly recurrence.')
        return
      }
      // Safety net: forcibly roll over the end date if the time is overnight
      let safeEndDate = endDate
      if (value.end_time <= value.start_time && safeEndDate === value.date) {
        safeEndDate = nextDay(value.date)
      }

      const startISO = new Date(`${value.date}T${value.start_time}`).toISOString()
      const endISO   = new Date(`${safeEndDate}T${value.end_time}`).toISOString()
      try {
        await shiftsApi.createShift({
          worker_id:  value.worker_id,
          client_id:  value.client_id,
          start_time: startISO,
          end_time:   endISO,
          location:   location || undefined,
          notes:      value.notes || undefined,
          recurrence: isRecurring
            ? { frequency, days_of_week: frequency === 'weekly' ? daysOfWeek : undefined, recurrence_end_date: recurrenceEndDate || undefined }
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
    setDaysOfWeek((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day])
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-ink/20" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] flex-col bg-paper border-l border-ink">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink">
          <Kicker>New Shift</Kicker>
          <button onClick={onClose} className="font-mono text-[18px] text-ink-soft hover:text-ink leading-none">×</button>
        </div>

        {/* Form body */}
        <form
          className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5"
          onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}
        >
          {/* Worker */}
          <form.Field name="worker_id" validators={{ onChange: ({ value }) => validate(schema.shape.worker_id, value) }}>
            {(field) => (
              <div>
                <label className={labelClass}>Worker</label>
                <select className={selectClass} value={field.state.value}
                  onChange={(e) => {
                    field.handleChange(e.target.value)
                    notifyFormChange(form.state.values.date, form.state.values.start_time, endDate, form.state.values.end_time, e.target.value, form.state.values.client_id)
                  }}
                  onBlur={field.handleBlur}
                >
                  <option value="">Select a worker…</option>
                  {workers.map((w) => <option key={w.id} value={w.id}>{w.first_name} {w.last_name}</option>)}
                </select>
                <FieldError error={field.state.meta.errors[0]} />
              </div>
            )}
          </form.Field>

          {/* Client */}
          <form.Field name="client_id" validators={{ onChange: ({ value }) => validate(schema.shape.client_id, value) }}>
            {(field) => (
              <div>
                <label className={labelClass}>Client</label>
                <select className={selectClass} value={field.state.value}
                  onChange={(e) => {
                    field.handleChange(e.target.value)
                    const selected = clients.find((c) => c.id === e.target.value)
                    setLocation(selected ? `${selected.street}, ${selected.city}, ${selected.province} ${selected.postal_code}` : '')
                    notifyFormChange(form.state.values.date, form.state.values.start_time, endDate, form.state.values.end_time, form.state.values.worker_id, e.target.value)
                  }}
                  onBlur={field.handleBlur}
                >
                  <option value="">Select a client…</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                </select>
                <FieldError error={field.state.meta.errors[0]} />
              </div>
            )}
          </form.Field>

          {/* Location */}
          <div>
            <label className={labelClass}>Location</label>
            <input className={inputClass} value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Auto-filled from client address" />
          </div>

          {/* Date row — end date appears beside start date for overnight shifts */}
          <div className="grid grid-cols-2 gap-3">
            <form.Field name="date" validators={{ onChange: ({ value }) => validate(schema.shape.date, value) }}>
              {(field) => (
                <div>
                  <label className={labelClass}>{endDate !== field.state.value ? 'Start Date' : 'Date'}</label>
                  <DateInput value={field.state.value}
                    onChange={(v) => {
                      field.handleChange(v)
                      if (endDate === nextDay(field.state.value)) setEndDate(nextDay(v))
                      else if (endDate === field.state.value) setEndDate(v)
                      notifyFormChange(v, form.state.values.start_time, endDate, form.state.values.end_time, form.state.values.worker_id, form.state.values.client_id)
                    }}
                    onBlur={field.handleBlur} className="w-full" />
                  <FieldError error={field.state.meta.errors[0]} />
                </div>
              )}
            </form.Field>

            {endDate !== form.state.values.date && (
              <div>
                <label className={labelClass}>End Date</label>
                <DateInput value={endDate}
                  min={form.state.values.date}
                  onChange={(v) => {
                    setEndDate(v)
                    notifyFormChange(form.state.values.date, form.state.values.start_time, v, form.state.values.end_time, form.state.values.worker_id, form.state.values.client_id)
                  }} className="w-full" />
                {endDate === form.state.values.date && (
                  <p className="mt-1 font-mono text-[9px] text-ink-soft">Same day — end date hidden</p>
                )}
              </div>
            )}
          </div>

          {/* Start / End time */}
          <div className="grid grid-cols-2 gap-3">
            <form.Field name="start_time" validators={{ onChange: ({ value }) => validate(schema.shape.start_time, value) }}>
              {(field) => (
                <div>
                  <label className={labelClass}>Start Time</label>
                  <input type="time" className={inputClass} value={field.state.value}
                    onChange={(e) => {
                      const newStart = e.target.value
                      field.handleChange(newStart)
                      const endTime = form.state.values.end_time
                      const date    = form.state.values.date
                      
                      // Auto-advance end date when crossing midnight
                      if (newStart && endTime && endTime <= newStart && endDate === date) {
                        setEndDate(nextDay(date))
                      }
                      // Auto-reset end date when no longer overnight
                      if (newStart && endTime && endTime > newStart && endDate === nextDay(date)) {
                        setEndDate(date)
                      }
                      
                      notifyFormChange(date, newStart, endDate, endTime, form.state.values.worker_id, form.state.values.client_id)
                    }}
                    onBlur={field.handleBlur} />
                  <FieldError error={field.state.meta.errors[0]} />
                </div>
              )}
            </form.Field>

            <form.Field name="end_time" validators={{ onChange: ({ value }) => validate(schema.shape.end_time, value) }}>
              {(field) => (
                <div>
                  <label className={labelClass}>End Time</label>
                  <input type="time" className={inputClass} value={field.state.value}
                    onChange={(e) => {
                      const newEnd = e.target.value
                      field.handleChange(newEnd)
                      const startTime = form.state.values.start_time
                      const date      = form.state.values.date
                      // Auto-advance end date when crossing midnight
                      if (newEnd && startTime && newEnd <= startTime && endDate === date) {
                        setEndDate(nextDay(date))
                      }
                      // Auto-reset end date when no longer overnight
                      if (newEnd && startTime && newEnd > startTime && endDate === nextDay(date)) {
                        setEndDate(date)
                      }
                      notifyFormChange(date, startTime, endDate, newEnd, form.state.values.worker_id, form.state.values.client_id)
                    }}
                    onBlur={field.handleBlur} />
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
                <textarea className={`${inputClass} resize-none`} rows={2} value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)} placeholder="Optional" />
              </div>
            )}
          </form.Field>

          {/* Recurrence */}
          <div className="border-t border-dashed border-line-soft pt-5">
            <label className="flex items-center gap-3 cursor-pointer">
              <button
                type="button"
                role="switch"
                aria-checked={isRecurring}
                onClick={() => setIsRecurring((v) => !v)}
                className={`relative inline-flex h-5 w-9 items-center border transition-colors ${
                  isRecurring ? 'bg-ink border-ink' : 'bg-cream-2 border-line-soft'
                }`}
              >
                <span className={`inline-block h-3 w-3 bg-cream transition-transform ${isRecurring ? 'translate-x-5' : 'translate-x-1'}`} />
              </button>
              <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-ink-soft">
                Repeat this shift
              </span>
            </label>

            {isRecurring && (
              <div className="mt-5 flex flex-col gap-5">

                {/* Frequency */}
                <div>
                  <p className={labelClass}>Frequency</p>
                  <div className="flex gap-2 mt-1">
                    {(['daily', 'weekly'] as RecurrenceFrequency[]).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFrequency(f)}
                        className={`px-4 py-2 font-mono text-[10px] tracking-[0.05em] uppercase border transition-colors ${
                          frequency === f ? 'bg-ink text-cream border-ink' : 'border-ink text-ink-soft hover:text-ink'
                        }`}
                      >
                        {f === 'daily' ? 'Daily' : 'Weekly'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Days of week */}
                {frequency === 'weekly' && (
                  <div>
                    <p className={labelClass}>Days</p>
                    <div className="flex gap-1.5 mt-1">
                      {ORDERED_DAYS.map((day) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleDay(day)}
                          className={`h-8 w-9 font-mono text-[9px] tracking-[0.05em] uppercase border transition-colors ${
                            daysOfWeek.includes(day)
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

                {/* End date */}
                <div>
                  <label className={labelClass}>End Date <span className="normal-case text-muted">(optional)</span></label>
                  <DateInput value={recurrenceEndDate} onChange={setRecurrenceEndDate} className="w-full" />
                  <p className="mt-1 font-mono text-[9px] text-muted">Leave blank to repeat indefinitely.</p>
                </div>
              </div>
            )}
          </div>

          {serverError && (
            <p className="font-mono text-[10px] text-orange border border-orange px-3 py-2">{serverError}</p>
          )}
        </form>

        {/* Footer */}
        <div className="border-t border-ink px-6 py-4 flex justify-end gap-3">
          <button type="button" onClick={onClose}
            className="border border-ink px-4 py-2 font-mono text-[10px] tracking-[0.08em] uppercase text-ink-soft hover:text-ink transition-colors">
            Cancel
          </button>
          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(isSubmitting) => (
              <button type="button" onClick={() => form.handleSubmit()} disabled={isSubmitting}
                className="bg-ink text-cream px-5 py-2 font-mono text-[10px] tracking-[0.08em] uppercase hover:opacity-80 disabled:opacity-40 transition-opacity">
                {isSubmitting ? 'Saving…' : isRecurring ? 'Create Recurring' : 'Create Shift'}
              </button>
            )}
          </form.Subscribe>
        </div>
      </div>
    </>
  )
}
