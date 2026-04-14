import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import { useState } from 'react'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { z } from 'zod'
import {
  workersApi,
  type Worker,
  type EmploymentType,
  EMPLOYMENT_TYPE_LABELS,
} from '@/features/workers/api'

export const Route = createFileRoute('/_protected/dashboard/workers/$workerId')({
  component: WorkerDetailPage,
})

// ─── Helpers ────────────────────────────────────────────────────────────────

function getInitials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
}

function toDateInput(value: string | null) {
  return value ? value.slice(0, 10) : ''
}

function FieldError({ error }: { error: unknown }) {
  if (!error) return null
  return <p className="mt-1 text-xs text-red-500">{error as string}</p>
}

const inputClass =
  'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400'
const labelClass = 'block text-sm font-medium text-gray-700'

// ─── Page shell ─────────────────────────────────────────────────────────────

function WorkerDetailPage() {
  const { workerId } = Route.useParams()

  const { data: worker, isLoading, isError } = useQuery({
    queryKey: ['worker', workerId],
    queryFn: () => workersApi.getWorker(workerId),
  })

  if (isLoading) {
    return <div className="p-8 text-sm text-gray-500">Loading…</div>
  }

  if (isError || !worker) {
    return <div className="p-8 text-sm text-red-500">Worker not found.</div>
  }

  return <WorkerDetailContent worker={worker} />
}

// ─── Content (rendered once worker data is available) ───────────────────────

function WorkerDetailContent({ worker }: { worker: Worker }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const initials = getInitials(worker.first_name, worker.last_name)

  const deleteMutation = useMutation({
    mutationFn: () => workersApi.deleteWorker(worker.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workers'] })
      navigate({ to: '/dashboard/workers' })
    },
    onError: (err: Error) => setDeleteError(err.message),
  })

  return (
    <div className="p-8 max-w-3xl">
      {/* Back */}
      <Link
        to="/dashboard/workers"
        className="mb-6 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"
      >
        <ArrowLeft size={14} />
        Workers
      </Link>

      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gray-900 text-lg font-semibold text-white">
          {initials}
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {worker.first_name} {worker.last_name}
          </h1>
          <p className="text-sm text-gray-500">{worker.email}</p>
        </div>
        <span
          className={`ml-auto rounded-full px-3 py-1 text-xs font-medium ${
            worker.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {worker.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Section 1: Personal Info */}
      <PersonalInfoForm worker={worker} />

      {/* Section 2: Work Profile */}
      <WorkProfileForm worker={worker} />

      {/* Danger zone */}
      <div className="mt-10 rounded-lg border border-red-200 bg-red-50 p-5">
        <h3 className="text-sm font-semibold text-red-800">Danger Zone</h3>
        <p className="mt-1 text-sm text-red-600">
          Deleting a worker is permanent and cannot be undone.
        </p>

        {deleteError && (
          <p className="mt-2 text-sm text-red-700 font-medium">{deleteError}</p>
        )}

        {deleteConfirm ? (
          <div className="mt-3 flex items-center gap-3">
            <span className="text-sm text-red-700">Are you sure?</span>
            <button
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Yes, delete'}
            </button>
            <button
              onClick={() => setDeleteConfirm(false)}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setDeleteConfirm(true)}
            className="mt-3 flex items-center gap-2 rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            <Trash2 size={14} />
            Delete Worker
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Section 1: Personal Info ────────────────────────────────────────────────

function PersonalInfoForm({ worker }: { worker: Worker }) {
  const queryClient = useQueryClient()
  const [saved, setSaved] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const schema = z.object({
    first_name: z.string().min(1, 'Required'),
    last_name: z.string().min(1, 'Required'),
    phone_number: z.string().optional(),
    gender: z.string().optional(),
    date_of_birth: z.string().optional(),
    hire_date: z.string().optional(),
    emergency_contact_name: z.string().optional(),
    emergency_contact_phone: z.string().optional(),
    emergency_contact_relationship: z.string().optional(),
  })

  const form = useForm({
    defaultValues: {
      first_name: worker.first_name,
      last_name: worker.last_name,
      phone_number: worker.phone_number ?? '',
      gender: worker.gender ?? '',
      date_of_birth: toDateInput(worker.date_of_birth),
      hire_date: toDateInput(worker.hire_date),
      emergency_contact_name: worker.emergency_contact_name ?? '',
      emergency_contact_phone: worker.emergency_contact_phone ?? '',
      emergency_contact_relationship: worker.emergency_contact_relationship ?? '',
    },
    onSubmit: async ({ value }) => {
      setServerError(null)
      setSaved(false)
      try {
        await workersApi.updateWorker(worker.id, {
          first_name: value.first_name,
          last_name: value.last_name,
          phone_number: value.phone_number || undefined,
          gender: value.gender || undefined,
          date_of_birth: value.date_of_birth || undefined,
          hire_date: value.hire_date || undefined,
          emergency_contact_name: value.emergency_contact_name || undefined,
          emergency_contact_phone: value.emergency_contact_phone || undefined,
          emergency_contact_relationship: value.emergency_contact_relationship || undefined,
        })
        queryClient.invalidateQueries({ queryKey: ['worker', worker.id] })
        queryClient.invalidateQueries({ queryKey: ['workers'] })
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      } catch (err: unknown) {
        setServerError(err instanceof Error ? err.message : 'Something went wrong')
      }
    },
  })

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 mb-6">
      <h2 className="mb-4 text-sm font-semibold text-gray-900">Personal Info</h2>

      <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}>
        <div className="flex gap-3">
          <form.Field
            name="first_name"
            validators={{ onChange: ({ value }) => {
              const r = schema.shape.first_name.safeParse(value)
              return r.success ? undefined : r.error.issues[0].message
            }}}
          >
            {(field) => (
              <div className="flex-1">
                <label className={labelClass}>First Name</label>
                <input className={inputClass} value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur} />
                <FieldError error={field.state.meta.errors[0]} />
              </div>
            )}
          </form.Field>

          <form.Field
            name="last_name"
            validators={{ onChange: ({ value }) => {
              const r = schema.shape.last_name.safeParse(value)
              return r.success ? undefined : r.error.issues[0].message
            }}}
          >
            {(field) => (
              <div className="flex-1">
                <label className={labelClass}>Last Name</label>
                <input className={inputClass} value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur} />
                <FieldError error={field.state.meta.errors[0]} />
              </div>
            )}
          </form.Field>
        </div>

        <div className="mt-3 flex gap-3">
          <form.Field name="phone_number">
            {(field) => (
              <div className="flex-1">
                <label className={labelClass}>Phone</label>
                <input className={inputClass} value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)} placeholder="+1 (555) 000-0000" />
              </div>
            )}
          </form.Field>

          <form.Field name="gender">
            {(field) => (
              <div className="flex-1">
                <label className={labelClass}>Gender</label>
                <select className={inputClass} value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}>
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
          <form.Field name="date_of_birth">
            {(field) => (
              <div className="flex-1">
                <label className={labelClass}>Date of Birth</label>
                <input type="date" className={inputClass} value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)} />
              </div>
            )}
          </form.Field>

          <form.Field name="hire_date">
            {(field) => (
              <div className="flex-1">
                <label className={labelClass}>Hire Date</label>
                <input type="date" className={inputClass} value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)} />
              </div>
            )}
          </form.Field>
        </div>

        <div className="mt-4 border-t border-gray-100 pt-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Emergency Contact
          </p>
          <form.Field name="emergency_contact_name">
            {(field) => (
              <div>
                <label className={labelClass}>Name</label>
                <input className={inputClass} value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)} placeholder="Full name" />
              </div>
            )}
          </form.Field>

          <div className="mt-3 flex gap-3">
            <form.Field name="emergency_contact_phone">
              {(field) => (
                <div className="flex-1">
                  <label className={labelClass}>Phone</label>
                  <input className={inputClass} value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)} placeholder="+1 (555) 000-0000" />
                </div>
              )}
            </form.Field>

            <form.Field name="emergency_contact_relationship">
              {(field) => (
                <div className="flex-1">
                  <label className={labelClass}>Relationship</label>
                  <input className={inputClass} value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)} placeholder="Spouse, Parent…" />
                </div>
              )}
            </form.Field>
          </div>
        </div>

        {serverError && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{serverError}</p>
        )}

        <div className="mt-4 flex items-center justify-end gap-3">
          {saved && <span className="text-sm text-green-600">Saved</span>}
          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(isSubmitting) => (
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving…' : 'Save'}
              </button>
            )}
          </form.Subscribe>
        </div>
      </form>
    </section>
  )
}

// ─── Section 2: Work Profile ─────────────────────────────────────────────────

function WorkProfileForm({ worker }: { worker: Worker }) {
  const queryClient = useQueryClient()
  const [saved, setSaved] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const profile = worker.worker_profile

  const form = useForm({
    defaultValues: {
      street: profile?.street ?? '',
      city: profile?.city ?? '',
      province: profile?.province ?? '',
      postal_code: profile?.postal_code ?? '',
      employment_type: (profile?.employment_type ?? '') as EmploymentType | '',
      has_vehicle: profile?.has_vehicle ?? false,
      max_hours_per_week: profile?.max_hours_per_week?.toString() ?? '',
      availability: profile?.availability ?? '',
    },
    onSubmit: async ({ value }) => {
      setServerError(null)
      setSaved(false)
      try {
        const maxHours = value.max_hours_per_week ? parseInt(value.max_hours_per_week, 10) : undefined
        await workersApi.updateWorkerProfile(worker.id, {
          street: value.street || undefined,
          city: value.city || undefined,
          province: value.province || undefined,
          postal_code: value.postal_code || undefined,
          employment_type: (value.employment_type as EmploymentType) || undefined,
          has_vehicle: value.has_vehicle,
          max_hours_per_week: isNaN(maxHours as number) ? undefined : maxHours,
          availability: value.availability || undefined,
        })
        queryClient.invalidateQueries({ queryKey: ['worker', worker.id] })
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      } catch (err: unknown) {
        setServerError(err instanceof Error ? err.message : 'Something went wrong')
      }
    },
  })

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="mb-4 text-sm font-semibold text-gray-900">Work Profile</h2>

      <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}>
        {/* Address */}
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Address</p>

        <form.Field name="street">
          {(field) => (
            <div>
              <label className={labelClass}>Street</label>
              <input className={inputClass} value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)} placeholder="123 Main St" />
            </div>
          )}
        </form.Field>

        <div className="mt-3 flex gap-3">
          <form.Field name="city">
            {(field) => (
              <div className="flex-1">
                <label className={labelClass}>City</label>
                <input className={inputClass} value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)} placeholder="Vancouver" />
              </div>
            )}
          </form.Field>

          <form.Field name="province">
            {(field) => (
              <div className="w-28">
                <label className={labelClass}>Province</label>
                <select className={inputClass} value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}>
                  <option value="">—</option>
                  {['AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT'].map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            )}
          </form.Field>

          <form.Field name="postal_code">
            {(field) => (
              <div className="w-28">
                <label className={labelClass}>Postal Code</label>
                <input className={inputClass} value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)} placeholder="V6B 1A1" />
              </div>
            )}
          </form.Field>
        </div>

        {/* Employment */}
        <p className="mb-3 mt-5 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Employment
        </p>

        <div className="flex gap-3">
          <form.Field name="employment_type">
            {(field) => (
              <div className="flex-1">
                <label className={labelClass}>Employment Type</label>
                <select className={inputClass} value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value as EmploymentType | '')}>
                  <option value="">Select…</option>
                  {(Object.entries(EMPLOYMENT_TYPE_LABELS) as [EmploymentType, string][]).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
            )}
          </form.Field>

          <form.Field name="max_hours_per_week">
            {(field) => (
              <div className="w-36">
                <label className={labelClass}>Max Hours / Week</label>
                <input
                  type="number"
                  min={0}
                  max={80}
                  className={inputClass}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="40"
                />
              </div>
            )}
          </form.Field>
        </div>

        <form.Field name="has_vehicle">
          {(field) => (
            <div className="mt-3 flex items-center gap-2">
              <input
                id="has_vehicle"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-gray-900"
                checked={field.state.value}
                onChange={(e) => field.handleChange(e.target.checked)}
              />
              <label htmlFor="has_vehicle" className="text-sm text-gray-700">
                Has a vehicle
              </label>
            </div>
          )}
        </form.Field>

        <form.Field name="availability">
          {(field) => (
            <div className="mt-3">
              <label className={labelClass}>Availability Notes</label>
              <textarea
                className={`${inputClass} resize-none`}
                rows={3}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="e.g. Weekdays 8am–5pm, not available Sundays…"
              />
            </div>
          )}
        </form.Field>

        {serverError && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{serverError}</p>
        )}

        <div className="mt-4 flex items-center justify-end gap-3">
          {saved && <span className="text-sm text-green-600">Saved</span>}
          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(isSubmitting) => (
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving…' : 'Save'}
              </button>
            )}
          </form.Subscribe>
        </div>
      </form>
    </section>
  )
}
