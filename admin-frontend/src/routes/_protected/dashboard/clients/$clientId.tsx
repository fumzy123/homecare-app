import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import { useState } from 'react'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { z } from 'zod'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { clientsApi, type ClientStatus, type ServiceType } from '@/features/clients/api'
import { shiftsApi, type ShiftOccurrence } from '@/features/shifts/api'
import { AvailabilityGrid, type ScheduleMap } from '@/shared/components/AvailabilityGrid'
import { ShiftDetailDrawer } from '@/features/shifts/components/ShiftDetailDrawer'

export const Route = createFileRoute('/_protected/dashboard/clients/$clientId')({
  component: ClientDetailPage,
})

const schema = z.object({
  first_name: z.string().min(1, 'Required'),
  last_name: z.string().min(1, 'Required'),
  date_of_birth: z.string().min(1, 'Required'),
  gender: z.string().optional(),
  phone_number: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  street: z.string().min(1, 'Required'),
  city: z.string().min(1, 'Required'),
  province: z.string().min(1, 'Required'),
  postal_code: z.string().min(1, 'Required'),
  service_type: z.enum(['personal_care', 'companionship', 'respite', 'nursing']),
  care_start_date: z.string().min(1, 'Required'),
  care_end_date: z.string().optional(),
  medical_conditions: z.string().optional(),
  allergies: z.string().optional(),
  medications: z.string().optional(),
  special_instructions: z.string().optional(),
  emergency_contact_name: z.string().min(1, 'Required'),
  emergency_contact_phone: z.string().min(1, 'Required'),
  emergency_contact_relationship: z.string().min(1, 'Required'),
  status: z.enum(['active', 'on_hold', 'discharged']),
  funding_source: z.string().optional(),
  notes: z.string().optional(),
})

function validate<T>(shape: z.ZodType<T>, value: T) {
  const r = shape.safeParse(value)
  return r.success ? undefined : r.error.issues[0].message
}

function FieldError({ error }: { error: unknown }) {
  if (!error) return null
  return <p className="mt-1 text-xs text-red-500">{error as string}</p>
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3 mt-8 border-t border-gray-100 pt-6 first:mt-0 first:border-none first:pt-0">
      {children}
    </h3>
  )
}

const inputClass =
  'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400'
const labelClass = 'block text-sm font-medium text-gray-700'

function ClientDetailPage() {
  const { clientId } = Route.useParams()
  const { data: client, isLoading, isError } = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => clientsApi.getClient(clientId),
  })

  if (isLoading) {
    return (
      <div className="p-8">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    )
  }

  if (isError || !client) {
    return (
      <div className="p-8">
        <p className="text-sm text-red-500">Failed to load client.</p>
        <Link to="/dashboard/clients" className="mt-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={14} /> Back to Clients
        </Link>
      </div>
    )
  }

  return <ClientDetailContent clientId={clientId} client={client} />
}

function ClientDetailContent({
  clientId,
  client,
}: {
  clientId: string
  client: ReturnType<typeof clientsApi.getClient> extends Promise<infer T> ? T : never
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [saved, setSaved] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: () => clientsApi.deleteClient(clientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      navigate({ to: '/dashboard/clients' })
    },
  })

  const form = useForm({
    defaultValues: {
      first_name: client.first_name,
      last_name: client.last_name,
      date_of_birth: client.date_of_birth,
      gender: client.gender ?? '',
      phone_number: client.phone_number ?? '',
      email: client.email ?? '',
      street: client.street,
      city: client.city,
      province: client.province,
      postal_code: client.postal_code,
      service_type: client.service_type,
      care_start_date: client.care_start_date,
      care_end_date: client.care_end_date ?? '',
      medical_conditions: client.medical_conditions ?? '',
      allergies: client.allergies ?? '',
      medications: client.medications ?? '',
      special_instructions: client.special_instructions ?? '',
      emergency_contact_name: client.emergency_contact_name,
      emergency_contact_phone: client.emergency_contact_phone,
      emergency_contact_relationship: client.emergency_contact_relationship,
      status: client.status,
      funding_source: client.funding_source ?? '',
      notes: client.notes ?? '',
      requested_schedule: (client.requested_schedule ?? {}) as ScheduleMap,
    },
    onSubmit: async ({ value }) => {
      setServerError(null)
      try {
        await clientsApi.updateClient(clientId, {
          first_name: value.first_name,
          last_name: value.last_name,
          date_of_birth: value.date_of_birth,
          gender: value.gender || undefined,
          phone_number: value.phone_number || undefined,
          email: value.email || undefined,
          street: value.street,
          city: value.city,
          province: value.province,
          postal_code: value.postal_code,
          service_type: value.service_type,
          care_start_date: value.care_start_date,
          care_end_date: value.care_end_date || undefined,
          medical_conditions: value.medical_conditions || undefined,
          allergies: value.allergies || undefined,
          medications: value.medications || undefined,
          special_instructions: value.special_instructions || undefined,
          emergency_contact_name: value.emergency_contact_name,
          emergency_contact_phone: value.emergency_contact_phone,
          emergency_contact_relationship: value.emergency_contact_relationship,
          status: value.status,
          funding_source: value.funding_source || undefined,
          notes: value.notes || undefined,
          requested_schedule: Object.keys(value.requested_schedule).length > 0 ? value.requested_schedule : undefined,
        })
        queryClient.invalidateQueries({ queryKey: ['clients'] })
        queryClient.invalidateQueries({ queryKey: ['client', clientId] })
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      } catch (err: unknown) {
        setServerError(err instanceof Error ? err.message : 'Something went wrong')
      }
    },
  })

  const initials = `${client.first_name[0] ?? ''}${client.last_name[0] ?? ''}`.toUpperCase()

  return (
    <div className="p-8 max-w-2xl">
      {/* Back link */}
      <Link
        to="/dashboard/clients"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={14} />
        Back to Clients
      </Link>

      {/* Header */}
      <div className="mt-4 flex items-center gap-4 mb-8">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-lg font-semibold text-white">
          {initials}
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {client.first_name} {client.last_name}
          </h1>
          <p className="text-sm text-gray-500">{client.city}, {client.province}</p>
        </div>
      </div>

      {/* Form */}
      <form
        onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}
      >
        {/* ── Personal Info ── */}
        <SectionHeading>Personal Info</SectionHeading>

        <div className="flex gap-3">
          <form.Field
            name="first_name"
            validators={{ onChange: ({ value }) => validate(schema.shape.first_name, value) }}
          >
            {(field) => (
              <div className="flex-1">
                <label className={labelClass}>First Name *</label>
                <input
                  className={inputClass}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
                <FieldError error={field.state.meta.errors[0]} />
              </div>
            )}
          </form.Field>

          <form.Field
            name="last_name"
            validators={{ onChange: ({ value }) => validate(schema.shape.last_name, value) }}
          >
            {(field) => (
              <div className="flex-1">
                <label className={labelClass}>Last Name *</label>
                <input
                  className={inputClass}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
                <FieldError error={field.state.meta.errors[0]} />
              </div>
            )}
          </form.Field>
        </div>

        <div className="mt-3 flex gap-3">
          <form.Field
            name="date_of_birth"
            validators={{ onChange: ({ value }) => validate(schema.shape.date_of_birth, value) }}
          >
            {(field) => (
              <div className="flex-1">
                <label className={labelClass}>Date of Birth *</label>
                <input
                  type="date"
                  className={inputClass}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
                <FieldError error={field.state.meta.errors[0]} />
              </div>
            )}
          </form.Field>

          <form.Field name="gender">
            {(field) => (
              <div className="flex-1">
                <label className={labelClass}>Gender</label>
                <select
                  className={inputClass}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                >
                  <option value="">Select…</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="non_binary">Non-binary</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>
            )}
          </form.Field>
        </div>

        <div className="mt-3 flex gap-3">
          <form.Field name="phone_number">
            {(field) => (
              <div className="flex-1">
                <label className={labelClass}>Phone</label>
                <input
                  className={inputClass}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                />
              </div>
            )}
          </form.Field>

          <form.Field
            name="email"
            validators={{ onChange: ({ value }) => validate(schema.shape.email, value) }}
          >
            {(field) => (
              <div className="flex-1">
                <label className={labelClass}>Email</label>
                <input
                  type="email"
                  className={inputClass}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="jane@example.com"
                />
                <FieldError error={field.state.meta.errors[0]} />
              </div>
            )}
          </form.Field>
        </div>

        {/* ── Address ── */}
        <SectionHeading>Address</SectionHeading>

        <form.Field
          name="street"
          validators={{ onChange: ({ value }) => validate(schema.shape.street, value) }}
        >
          {(field) => (
            <div>
              <label className={labelClass}>Street *</label>
              <input
                className={inputClass}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder="123 Main St"
              />
              <FieldError error={field.state.meta.errors[0]} />
            </div>
          )}
        </form.Field>

        <div className="mt-3 flex gap-3">
          <form.Field
            name="city"
            validators={{ onChange: ({ value }) => validate(schema.shape.city, value) }}
          >
            {(field) => (
              <div className="flex-1">
                <label className={labelClass}>City *</label>
                <input
                  className={inputClass}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
                <FieldError error={field.state.meta.errors[0]} />
              </div>
            )}
          </form.Field>

          <form.Field
            name="province"
            validators={{ onChange: ({ value }) => validate(schema.shape.province, value) }}
          >
            {(field) => (
              <div className="w-28">
                <label className={labelClass}>Province *</label>
                <select
                  className={inputClass}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                >
                  <option value="">—</option>
                  {['AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT'].map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                <FieldError error={field.state.meta.errors[0]} />
              </div>
            )}
          </form.Field>

          <form.Field
            name="postal_code"
            validators={{ onChange: ({ value }) => validate(schema.shape.postal_code, value) }}
          >
            {(field) => (
              <div className="w-28">
                <label className={labelClass}>Postal Code *</label>
                <input
                  className={inputClass}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="V6B 1A1"
                />
                <FieldError error={field.state.meta.errors[0]} />
              </div>
            )}
          </form.Field>
        </div>

        {/* ── Care Details ── */}
        <SectionHeading>Care Details</SectionHeading>

        <div className="flex gap-3">
          <form.Field
            name="service_type"
            validators={{ onChange: ({ value }) => validate(schema.shape.service_type, value) }}
          >
            {(field) => (
              <div className="flex-1">
                <label className={labelClass}>Service Type *</label>
                <select
                  className={inputClass}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value as ServiceType)}
                  onBlur={field.handleBlur}
                >
                  <option value="personal_care">Personal Care</option>
                  <option value="companionship">Companionship</option>
                  <option value="respite">Respite</option>
                  <option value="nursing">Nursing</option>
                </select>
                <FieldError error={field.state.meta.errors[0]} />
              </div>
            )}
          </form.Field>

          <form.Field name="status">
            {(field) => (
              <div className="flex-1">
                <label className={labelClass}>Status</label>
                <select
                  className={inputClass}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value as ClientStatus)}
                >
                  <option value="active">Active</option>
                  <option value="on_hold">On Hold</option>
                  <option value="discharged">Discharged</option>
                </select>
              </div>
            )}
          </form.Field>
        </div>

        <div className="mt-3 flex gap-3">
          <form.Field
            name="care_start_date"
            validators={{ onChange: ({ value }) => validate(schema.shape.care_start_date, value) }}
          >
            {(field) => (
              <div className="flex-1">
                <label className={labelClass}>Care Start Date *</label>
                <input
                  type="date"
                  className={inputClass}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
                <FieldError error={field.state.meta.errors[0]} />
              </div>
            )}
          </form.Field>

          <form.Field name="care_end_date">
            {(field) => (
              <div className="flex-1">
                <label className={labelClass}>Care End Date</label>
                <input
                  type="date"
                  className={inputClass}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </div>
            )}
          </form.Field>
        </div>

        {(['medical_conditions', 'allergies', 'medications', 'special_instructions'] as const).map((name) => (
          <form.Field key={name} name={name}>
            {(field) => (
              <div className="mt-3">
                <label className={labelClass}>
                  {name === 'medical_conditions' ? 'Medical Conditions'
                    : name === 'allergies' ? 'Allergies'
                    : name === 'medications' ? 'Medications'
                    : 'Special Instructions'}
                </label>
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
        ))}

        {/* ── Emergency Contact ── */}
        <SectionHeading>Emergency Contact</SectionHeading>

        <form.Field
          name="emergency_contact_name"
          validators={{ onChange: ({ value }) => validate(schema.shape.emergency_contact_name, value) }}
        >
          {(field) => (
            <div>
              <label className={labelClass}>Name *</label>
              <input
                className={inputClass}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder="John Doe"
              />
              <FieldError error={field.state.meta.errors[0]} />
            </div>
          )}
        </form.Field>

        <div className="mt-3 flex gap-3">
          <form.Field
            name="emergency_contact_phone"
            validators={{ onChange: ({ value }) => validate(schema.shape.emergency_contact_phone, value) }}
          >
            {(field) => (
              <div className="flex-1">
                <label className={labelClass}>Phone *</label>
                <input
                  className={inputClass}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="+1 (555) 000-0000"
                />
                <FieldError error={field.state.meta.errors[0]} />
              </div>
            )}
          </form.Field>

          <form.Field
            name="emergency_contact_relationship"
            validators={{ onChange: ({ value }) => validate(schema.shape.emergency_contact_relationship, value) }}
          >
            {(field) => (
              <div className="flex-1">
                <label className={labelClass}>Relationship *</label>
                <input
                  className={inputClass}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="Spouse, Parent…"
                />
                <FieldError error={field.state.meta.errors[0]} />
              </div>
            )}
          </form.Field>
        </div>

        {/* ── Requested Schedule ── */}
        <SectionHeading>Requested Schedule</SectionHeading>

        <form.Field name="requested_schedule">
          {(field) => (
            <AvailabilityGrid
              value={field.state.value}
              onChange={(v) => field.handleChange(v)}
            />
          )}
        </form.Field>

        {/* ── Administrative ── */}
        <SectionHeading>Administrative</SectionHeading>

        <form.Field name="funding_source">
          {(field) => (
            <div>
              <label className={labelClass}>Funding Source</label>
              <input
                className={inputClass}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="e.g. CLBC, Private"
              />
            </div>
          )}
        </form.Field>

        <form.Field name="notes">
          {(field) => (
            <div className="mt-3">
              <label className={labelClass}>Notes</label>
              <textarea
                className={`${inputClass} resize-none`}
                rows={3}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Any additional notes…"
              />
            </div>
          )}
        </form.Field>

        {serverError && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{serverError}</p>
        )}

        {/* Save button */}
        <div className="mt-6 flex items-center gap-3">
          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(isSubmitting) => (
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-md bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving…' : 'Save Changes'}
              </button>
            )}
          </form.Subscribe>
          {saved && (
            <span className="text-sm font-medium text-green-600">Saved</span>
          )}
        </div>
      </form>

      {/* ── Shift History ── */}
      <ShiftHistorySection clientId={clientId} />

      {/* ── Danger Zone ── */}
      <div className="mt-12 rounded-lg border border-red-200 p-5">
        <h3 className="text-sm font-semibold text-red-700">Danger Zone</h3>
        <p className="mt-1 text-sm text-gray-500">
          Permanently delete this client profile and all associated data.
        </p>
        {!deleteConfirm ? (
          <button
            onClick={() => setDeleteConfirm(true)}
            className="mt-4 flex items-center gap-2 rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            <Trash2 size={14} />
            Delete Client
          </button>
        ) : (
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Yes, delete permanently'}
            </button>
            <button
              onClick={() => setDeleteConfirm(false)}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            {deleteMutation.isError && (
              <p className="text-sm text-red-500">
                {deleteMutation.error instanceof Error ? deleteMutation.error.message : 'Something went wrong'}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="h-16" />
    </div>
  )
}

// ─── Shift History ────────────────────────────────────────────────────────────

function ShiftHistorySection({ clientId }: { clientId: string }) {
  const from = format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const to   = format(endOfMonth(new Date()), 'yyyy-MM-dd')
  const [selectedShift, setSelectedShift] = useState<ShiftOccurrence | null>(null)

  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ['shifts', from, to, '', clientId],
    queryFn: () => shiftsApi.listShifts(from, to, undefined, clientId),
  })

  const sorted = [...shifts].sort(
    (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
  )

  function pillClass(status: string) {
    switch (status.toLowerCase()) {
      case 'completed': return 'bg-green-50 text-green-700'
      case 'cancelled': return 'bg-red-50 text-red-600'
      default: return 'bg-gray-100 text-gray-600'
    }
  }

  return (
    <>
      <div className="mt-10 rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className="text-sm font-semibold text-gray-900">Shift History</h3>
          <span className="text-xs text-gray-400">{format(new Date(), 'MMMM yyyy')}</span>
        </div>

        {isLoading ? (
          <p className="px-5 py-6 text-center text-sm text-gray-400">Loading…</p>
        ) : sorted.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-gray-400">No shifts this month</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Date</th>
                <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Worker</th>
                <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Time</th>
                <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Hours</th>
                <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sorted.map((shift) => {
                const hours = (
                  (new Date(shift.end_time).getTime() - new Date(shift.start_time).getTime()) / 3600000
                ).toFixed(2)
                return (
                  <tr
                    key={`${shift.shift_id}-${shift.date}`}
                    onClick={() => setSelectedShift(shift)}
                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-5 py-3 text-gray-700">{format(new Date(shift.date), 'MMM d')}</td>
                    <td className="px-5 py-3 text-gray-700">{shift.worker.first_name} {shift.worker.last_name}</td>
                    <td className="px-5 py-3 text-gray-500 tabular-nums">
                      {format(new Date(shift.start_time), 'h:mm a')} – {format(new Date(shift.end_time), 'h:mm a')}
                    </td>
                    <td className="px-5 py-3 text-gray-700 tabular-nums">{hours} h</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${pillClass(shift.completion_status)}`}>
                        {shift.completion_status.charAt(0).toUpperCase() + shift.completion_status.slice(1)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {selectedShift && (
        <ShiftDetailDrawer shift={selectedShift} onClose={() => setSelectedShift(null)} />
      )}
    </>
  )
}
