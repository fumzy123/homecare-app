import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import { useState } from 'react'
import { z } from 'zod'
import {
  workersApi,
  type Worker,
  type EmploymentType,
  EMPLOYMENT_TYPE_LABELS,
} from '@/features/workers/api'
import { AvailabilityGrid, type ScheduleMap } from '@/shared/components/AvailabilityGrid'
import { Kicker, DateInput } from '@/shared/components/ui'

export const Route = createFileRoute('/_protected/dashboard/workers/$workerId/edit')({
  component: WorkerEditPage,
})

// ─── Shared styles ────────────────────────────────────────────────────────────

const labelClass = 'block font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mb-1'
const inputClass = 'w-full bg-paper border border-ink px-3 py-2 font-mono text-[11px] text-ink focus:outline-none focus:ring-1 focus:ring-ink'
const selectClass = `${inputClass} appearance-none`

function toDateInput(value: string | null) {
  return value ? value.slice(0, 10) : ''
}

function FieldError({ error }: { error: unknown }) {
  if (!error) return null
  return <p className="mt-1 font-mono text-[10px] text-orange">{error as string}</p>
}

function SavedBadge() {
  return <span className="font-mono text-[10px] text-mint tracking-wide uppercase">Saved ✓</span>
}

// ─── Page ────────────────────────────────────────────────────────────────────

function WorkerEditPage() {
  const { workerId } = Route.useParams()

  const { data: worker, isLoading, isError } = useQuery({
    queryKey: ['worker', workerId],
    queryFn: () => workersApi.getWorker(workerId),
  })

  if (isLoading) return <div className="p-10 font-mono text-[11px] text-muted">Loading…</div>
  if (isError || !worker) return <div className="p-10 font-mono text-[11px] text-orange">Worker not found.</div>

  return (
    <div className="p-10 space-y-6">
      <Link
        to="/dashboard/workers/$workerId"
        params={{ workerId } as never}
        className="font-mono text-[10px] tracking-[0.08em] uppercase text-ink-soft hover:text-ink"
      >
        ← Overview
      </Link>

      <div className="h-2" />
      <PersonalInfoForm worker={worker} />
      <WorkProfileForm worker={worker} />
      <DangerZone worker={worker} />
    </div>
  )
}

// ─── Personal Info Form ───────────────────────────────────────────────────────

function PersonalInfoForm({ worker }: { worker: Worker }) {
  const queryClient = useQueryClient()
  const [saved, setSaved] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const schema = z.object({
    first_name: z.string().min(1, 'Required'),
    last_name: z.string().min(1, 'Required'),
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
      is_active: worker.is_active,
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
          is_active: value.is_active,
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
    <section className="border border-ink bg-paper">
      <div className="flex items-center justify-between px-6 py-4 border-b border-ink">
        <Kicker>Personal info</Kicker>
        <form.Field name="is_active">
          {(field) => (
            <label className="flex items-center gap-2.5 cursor-pointer">
              <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-ink-soft">
                {field.state.value ? 'Active' : 'Inactive'}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={field.state.value}
                onClick={() => field.handleChange(!field.state.value)}
                className={`relative inline-flex h-5 w-9 items-center border transition-colors ${
                  field.state.value ? 'bg-ink border-ink' : 'bg-cream-2 border-line-soft'
                }`}
              >
                <span className={`inline-block h-3 w-3 bg-cream transition-transform ${
                  field.state.value ? 'translate-x-5' : 'translate-x-1'
                }`} />
              </button>
            </label>
          )}
        </form.Field>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }} className="px-6 py-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <form.Field name="first_name" validators={{ onChange: ({ value }) => {
            const r = schema.shape.first_name.safeParse(value)
            return r.success ? undefined : r.error.issues[0].message
          }}}>
            {(field) => (
              <div>
                <label className={labelClass}>First Name</label>
                <input className={inputClass} value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur} />
                <FieldError error={field.state.meta.errors[0]} />
              </div>
            )}
          </form.Field>

          <form.Field name="last_name" validators={{ onChange: ({ value }) => {
            const r = schema.shape.last_name.safeParse(value)
            return r.success ? undefined : r.error.issues[0].message
          }}}>
            {(field) => (
              <div>
                <label className={labelClass}>Last Name</label>
                <input className={inputClass} value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur} />
                <FieldError error={field.state.meta.errors[0]} />
              </div>
            )}
          </form.Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <form.Field name="phone_number">
            {(field) => (
              <div>
                <label className={labelClass}>Phone</label>
                <input className={inputClass} value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)} placeholder="+1 (555) 000-0000" />
              </div>
            )}
          </form.Field>

          <form.Field name="gender">
            {(field) => (
              <div>
                <label className={labelClass}>Gender</label>
                <select className={selectClass} value={field.state.value}
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

        <div className="grid grid-cols-2 gap-4">
          <form.Field name="date_of_birth">
            {(field) => (
              <div>
                <label className={labelClass}>Date of Birth</label>
                <DateInput value={field.state.value} onChange={(v) => field.handleChange(v)} className="w-full" />
              </div>
            )}
          </form.Field>

          <form.Field name="hire_date">
            {(field) => (
              <div>
                <label className={labelClass}>Hire Date</label>
                <DateInput value={field.state.value} onChange={(v) => field.handleChange(v)} className="w-full" />
              </div>
            )}
          </form.Field>
        </div>

        <div className="border-t border-dashed border-line-soft pt-4">
          <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft mb-4">Emergency Contact</p>

          <form.Field name="emergency_contact_name">
            {(field) => (
              <div className="mb-4">
                <label className={labelClass}>Name</label>
                <input className={inputClass} value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)} placeholder="Full name" />
              </div>
            )}
          </form.Field>

          <div className="grid grid-cols-2 gap-4">
            <form.Field name="emergency_contact_phone">
              {(field) => (
                <div>
                  <label className={labelClass}>Phone</label>
                  <input className={inputClass} value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)} placeholder="+1 (555) 000-0000" />
                </div>
              )}
            </form.Field>

            <form.Field name="emergency_contact_relationship">
              {(field) => (
                <div>
                  <label className={labelClass}>Relationship</label>
                  <input className={inputClass} value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)} placeholder="Spouse, Parent…" />
                </div>
              )}
            </form.Field>
          </div>
        </div>

        {serverError && (
          <p className="font-mono text-[10px] text-orange border border-orange px-3 py-2">{serverError}</p>
        )}

        <div className="flex items-center justify-end gap-4 pt-2">
          {saved && <SavedBadge />}
          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(isSubmitting) => (
              <button type="submit" disabled={isSubmitting}
                className="bg-ink text-cream px-5 py-2 font-mono text-[10px] tracking-[0.08em] uppercase hover:opacity-80 disabled:opacity-40 transition-opacity">
                {isSubmitting ? 'Saving…' : 'Save'}
              </button>
            )}
          </form.Subscribe>
        </div>
      </form>
    </section>
  )
}

// ─── Work Profile Form ────────────────────────────────────────────────────────

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
      availability: (profile?.availability ?? {}) as ScheduleMap,
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
          availability: Object.keys(value.availability).length > 0 ? value.availability : undefined,
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
    <section className="border border-ink bg-paper">
      <div className="px-6 py-4 border-b border-ink">
        <Kicker>Work profile</Kicker>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }} className="px-6 py-6 space-y-4">
        <div>
          <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft mb-4">Address</p>

          <form.Field name="street">
            {(field) => (
              <div className="mb-4">
                <label className={labelClass}>Street</label>
                <input className={inputClass} value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)} placeholder="123 Main St" />
              </div>
            )}
          </form.Field>

          <div className="grid grid-cols-[1fr_120px_120px] gap-4">
            <form.Field name="city">
              {(field) => (
                <div>
                  <label className={labelClass}>City</label>
                  <input className={inputClass} value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)} placeholder="Vancouver" />
                </div>
              )}
            </form.Field>

            <form.Field name="province">
              {(field) => (
                <div>
                  <label className={labelClass}>Province</label>
                  <select className={selectClass} value={field.state.value}
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
                <div>
                  <label className={labelClass}>Postal Code</label>
                  <input className={inputClass} value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)} placeholder="V6B 1A1" />
                </div>
              )}
            </form.Field>
          </div>
        </div>

        <div className="border-t border-dashed border-line-soft pt-4">
          <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft mb-4">Employment</p>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <form.Field name="employment_type">
              {(field) => (
                <div>
                  <label className={labelClass}>Employment Type</label>
                  <select className={selectClass} value={field.state.value}
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
                <div>
                  <label className={labelClass}>Max Hours / Week</label>
                  <input type="number" min={0} max={80} className={inputClass}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)} placeholder="40" />
                </div>
              )}
            </form.Field>
          </div>

          <form.Field name="has_vehicle">
            {(field) => (
              <label className="flex items-center gap-2.5 cursor-pointer">
                <button
                  type="button"
                  role="switch"
                  aria-checked={field.state.value}
                  onClick={() => field.handleChange(!field.state.value)}
                  className={`relative inline-flex h-5 w-9 items-center border transition-colors ${
                    field.state.value ? 'bg-ink border-ink' : 'bg-cream-2 border-line-soft'
                  }`}
                >
                  <span className={`inline-block h-3 w-3 bg-cream transition-transform ${
                    field.state.value ? 'translate-x-5' : 'translate-x-1'
                  }`} />
                </button>
                <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-ink-soft">
                  Has a vehicle
                </span>
              </label>
            )}
          </form.Field>
        </div>

        <div className="border-t border-dashed border-line-soft pt-4">
          <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft mb-4">Availability</p>
          <form.Field name="availability">
            {(field) => (
              <AvailabilityGrid value={field.state.value} onChange={(v) => field.handleChange(v)} />
            )}
          </form.Field>
        </div>

        {serverError && (
          <p className="font-mono text-[10px] text-orange border border-orange px-3 py-2">{serverError}</p>
        )}

        <div className="flex items-center justify-end gap-4 pt-2">
          {saved && <SavedBadge />}
          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(isSubmitting) => (
              <button type="submit" disabled={isSubmitting}
                className="bg-ink text-cream px-5 py-2 font-mono text-[10px] tracking-[0.08em] uppercase hover:opacity-80 disabled:opacity-40 transition-opacity">
                {isSubmitting ? 'Saving…' : 'Save'}
              </button>
            )}
          </form.Subscribe>
        </div>
      </form>
    </section>
  )
}

// ─── Danger Zone ─────────────────────────────────────────────────────────────

function DangerZone({ worker }: { worker: Worker }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const deleteMutation = useMutation({
    mutationFn: () => workersApi.deleteWorker(worker.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workers'] })
      navigate({ to: '/dashboard/workers' })
    },
    onError: (err: Error) => setDeleteError(err.message),
  })

  return (
    <section className="border border-orange bg-paper">
      <div className="px-6 py-4 border-b border-orange">
        <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-orange">Danger zone</p>
      </div>
      <div className="px-6 py-5">
        <p className="font-mono text-[11px] text-ink-soft mb-4">
          Deleting a worker is permanent and cannot be undone.
        </p>

        {deleteError && (
          <p className="font-mono text-[10px] text-orange mb-3">{deleteError}</p>
        )}

        {deleteConfirm ? (
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] text-ink-soft uppercase tracking-wide">Are you sure?</span>
            <button
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="bg-orange text-white px-4 py-2 font-mono text-[10px] tracking-[0.08em] uppercase hover:opacity-80 disabled:opacity-40 transition-opacity"
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Yes, delete'}
            </button>
            <button
              onClick={() => setDeleteConfirm(false)}
              className="border border-ink px-4 py-2 font-mono text-[10px] tracking-[0.08em] uppercase text-ink-soft hover:text-ink transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setDeleteConfirm(true)}
            className="border border-orange text-orange px-4 py-2 font-mono text-[10px] tracking-[0.08em] uppercase hover:bg-orange hover:text-white transition-colors"
          >
            Delete Worker
          </button>
        )}
      </div>
    </section>
  )
}
