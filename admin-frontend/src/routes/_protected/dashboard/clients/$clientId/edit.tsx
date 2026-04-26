import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import { useState } from 'react'
import { z } from 'zod'
import { clientsApi, type ClientStatus, type ServiceType } from '@/features/clients/api'
import { AvailabilityGrid, type ScheduleMap } from '@/shared/components/AvailabilityGrid'
import { Kicker } from '@/shared/components/ui'

export const Route = createFileRoute('/_protected/dashboard/clients/$clientId/edit')({
  component: ClientEditPage,
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
  return <p className="mt-1 font-mono text-[10px] text-orange">{error as string}</p>
}

function SavedBadge() {
  return <span className="font-mono text-[10px] text-mint tracking-wide uppercase">Saved ✓</span>
}

const labelClass  = 'block font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mb-1'
const inputClass  = 'w-full bg-paper border border-ink px-3 py-2 font-mono text-[11px] text-ink focus:outline-none focus:ring-1 focus:ring-ink'
const selectClass = `${inputClass} appearance-none`

const PROVINCES = ['AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT']

// ─── Page ────────────────────────────────────────────────────────────────────

function ClientEditPage() {
  const { clientId } = Route.useParams()

  const { data: client, isLoading, isError } = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => clientsApi.getClient(clientId),
  })

  if (isLoading) return <div className="p-10 font-mono text-[11px] text-muted">Loading…</div>
  if (isError || !client) return <div className="p-10 font-mono text-[11px] text-orange">Failed to load client.</div>

  return (
    <div className="p-10 space-y-6">
      <Link to="/dashboard/clients/$clientId" params={{ clientId } as never}
        className="font-mono text-[10px] tracking-[0.08em] uppercase text-ink-soft hover:text-ink">
        ← Overview
      </Link>
      <div className="h-2" />
      <ClientEditForm clientId={clientId} client={client} />
      <DangerZone clientId={clientId} />
    </div>
  )
}

// ─── Edit Form ────────────────────────────────────────────────────────────────

type ClientType = Awaited<ReturnType<typeof clientsApi.getClient>>

function ClientEditForm({ clientId, client }: { clientId: string; client: ClientType }) {
  const queryClient = useQueryClient()
  const [saved, setSaved]             = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

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
          ...value,
          gender: value.gender || undefined,
          phone_number: value.phone_number || undefined,
          email: value.email || undefined,
          care_end_date: value.care_end_date || undefined,
          medical_conditions: value.medical_conditions || undefined,
          allergies: value.allergies || undefined,
          medications: value.medications || undefined,
          special_instructions: value.special_instructions || undefined,
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

  const footer = (
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
  )

  return (
    <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }} className="space-y-6">

      {/* Personal Info */}
      <section className="border border-ink bg-paper">
        <div className="px-6 py-4 border-b border-ink"><Kicker>Personal info</Kicker></div>
        <div className="px-6 py-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <form.Field name="first_name" validators={{ onChange: ({ value }) => validate(schema.shape.first_name, value) }}>
              {(field) => (<div><label className={labelClass}>First Name</label><input className={inputClass} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur} /><FieldError error={field.state.meta.errors[0]} /></div>)}
            </form.Field>
            <form.Field name="last_name" validators={{ onChange: ({ value }) => validate(schema.shape.last_name, value) }}>
              {(field) => (<div><label className={labelClass}>Last Name</label><input className={inputClass} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur} /><FieldError error={field.state.meta.errors[0]} /></div>)}
            </form.Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <form.Field name="date_of_birth" validators={{ onChange: ({ value }) => validate(schema.shape.date_of_birth, value) }}>
              {(field) => (<div><label className={labelClass}>Date of Birth</label><input type="date" className={inputClass} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur} /><FieldError error={field.state.meta.errors[0]} /></div>)}
            </form.Field>
            <form.Field name="gender">
              {(field) => (<div><label className={labelClass}>Gender</label><select className={selectClass} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)}><option value="">Select…</option><option value="male">Male</option><option value="female">Female</option><option value="non_binary">Non-binary</option><option value="prefer_not_to_say">Prefer not to say</option></select></div>)}
            </form.Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <form.Field name="phone_number">
              {(field) => (<div><label className={labelClass}>Phone</label><input className={inputClass} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} placeholder="+1 (555) 000-0000" /></div>)}
            </form.Field>
            <form.Field name="email" validators={{ onChange: ({ value }) => validate(schema.shape.email, value) }}>
              {(field) => (<div><label className={labelClass}>Email</label><input type="email" className={inputClass} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} /><FieldError error={field.state.meta.errors[0]} /></div>)}
            </form.Field>
          </div>
          {serverError && <p className="font-mono text-[10px] text-orange border border-orange px-3 py-2">{serverError}</p>}
          {footer}
        </div>
      </section>

      {/* Address */}
      <section className="border border-ink bg-paper">
        <div className="px-6 py-4 border-b border-ink"><Kicker>Address</Kicker></div>
        <div className="px-6 py-6 space-y-4">
          <form.Field name="street" validators={{ onChange: ({ value }) => validate(schema.shape.street, value) }}>
            {(field) => (<div><label className={labelClass}>Street</label><input className={inputClass} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur} placeholder="123 Main St" /><FieldError error={field.state.meta.errors[0]} /></div>)}
          </form.Field>
          <div className="grid grid-cols-[1fr_100px_100px] gap-4">
            <form.Field name="city" validators={{ onChange: ({ value }) => validate(schema.shape.city, value) }}>
              {(field) => (<div><label className={labelClass}>City</label><input className={inputClass} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur} /><FieldError error={field.state.meta.errors[0]} /></div>)}
            </form.Field>
            <form.Field name="province" validators={{ onChange: ({ value }) => validate(schema.shape.province, value) }}>
              {(field) => (<div><label className={labelClass}>Province</label><select className={selectClass} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur}><option value="">—</option>{PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}</select><FieldError error={field.state.meta.errors[0]} /></div>)}
            </form.Field>
            <form.Field name="postal_code" validators={{ onChange: ({ value }) => validate(schema.shape.postal_code, value) }}>
              {(field) => (<div><label className={labelClass}>Postal Code</label><input className={inputClass} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur} placeholder="V6B 1A1" /><FieldError error={field.state.meta.errors[0]} /></div>)}
            </form.Field>
          </div>
          {footer}
        </div>
      </section>

      {/* Care Details */}
      <section className="border border-ink bg-paper">
        <div className="px-6 py-4 border-b border-ink"><Kicker>Care details</Kicker></div>
        <div className="px-6 py-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <form.Field name="service_type" validators={{ onChange: ({ value }) => validate(schema.shape.service_type, value) }}>
              {(field) => (<div><label className={labelClass}>Service Type</label><select className={selectClass} value={field.state.value} onChange={(e) => field.handleChange(e.target.value as ServiceType)} onBlur={field.handleBlur}><option value="personal_care">Personal Care</option><option value="companionship">Companionship</option><option value="respite">Respite</option><option value="nursing">Nursing</option></select><FieldError error={field.state.meta.errors[0]} /></div>)}
            </form.Field>
            <form.Field name="status">
              {(field) => (<div><label className={labelClass}>Status</label><select className={selectClass} value={field.state.value} onChange={(e) => field.handleChange(e.target.value as ClientStatus)}><option value="active">Active</option><option value="on_hold">On Hold</option><option value="discharged">Discharged</option></select></div>)}
            </form.Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <form.Field name="care_start_date" validators={{ onChange: ({ value }) => validate(schema.shape.care_start_date, value) }}>
              {(field) => (<div><label className={labelClass}>Care Start</label><input type="date" className={inputClass} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur} /><FieldError error={field.state.meta.errors[0]} /></div>)}
            </form.Field>
            <form.Field name="care_end_date">
              {(field) => (<div><label className={labelClass}>Care End</label><input type="date" className={inputClass} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} /></div>)}
            </form.Field>
          </div>
          <form.Field name="funding_source">
            {(field) => (<div><label className={labelClass}>Funding Source</label><input className={inputClass} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} placeholder="e.g. CLBC, Private" /></div>)}
          </form.Field>
          {(['medical_conditions', 'allergies', 'medications', 'special_instructions'] as const).map((name) => (
            <form.Field key={name} name={name}>
              {(field) => (
                <div>
                  <label className={labelClass}>{name === 'medical_conditions' ? 'Medical Conditions' : name === 'allergies' ? 'Allergies' : name === 'medications' ? 'Medications' : 'Special Instructions'}</label>
                  <textarea className={`${inputClass} resize-none`} rows={2} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} placeholder="Optional" />
                </div>
              )}
            </form.Field>
          ))}
          <form.Field name="notes">
            {(field) => (<div><label className={labelClass}>Notes</label><textarea className={`${inputClass} resize-none`} rows={3} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} placeholder="Optional" /></div>)}
          </form.Field>
          {footer}
        </div>
      </section>

      {/* Emergency Contact */}
      <section className="border border-ink bg-paper">
        <div className="px-6 py-4 border-b border-ink"><Kicker>Emergency contact</Kicker></div>
        <div className="px-6 py-6 space-y-4">
          <form.Field name="emergency_contact_name" validators={{ onChange: ({ value }) => validate(schema.shape.emergency_contact_name, value) }}>
            {(field) => (<div><label className={labelClass}>Name</label><input className={inputClass} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur} placeholder="Full name" /><FieldError error={field.state.meta.errors[0]} /></div>)}
          </form.Field>
          <div className="grid grid-cols-2 gap-4">
            <form.Field name="emergency_contact_phone" validators={{ onChange: ({ value }) => validate(schema.shape.emergency_contact_phone, value) }}>
              {(field) => (<div><label className={labelClass}>Phone</label><input className={inputClass} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur} placeholder="+1 (555) 000-0000" /><FieldError error={field.state.meta.errors[0]} /></div>)}
            </form.Field>
            <form.Field name="emergency_contact_relationship" validators={{ onChange: ({ value }) => validate(schema.shape.emergency_contact_relationship, value) }}>
              {(field) => (<div><label className={labelClass}>Relationship</label><input className={inputClass} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur} placeholder="Spouse, Parent…" /><FieldError error={field.state.meta.errors[0]} /></div>)}
            </form.Field>
          </div>
          {footer}
        </div>
      </section>

      {/* Requested Schedule */}
      <section className="border border-ink bg-paper">
        <div className="px-6 py-4 border-b border-ink"><Kicker>Requested schedule</Kicker></div>
        <div className="px-6 py-6">
          <form.Field name="requested_schedule">
            {(field) => (<AvailabilityGrid value={field.state.value} onChange={(v) => field.handleChange(v)} />)}
          </form.Field>
          <div className="mt-4">{footer}</div>
        </div>
      </section>
    </form>
  )
}

// ─── Danger Zone ─────────────────────────────────────────────────────────────

function DangerZone({ clientId }: { clientId: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteError, setDeleteError]     = useState<string | null>(null)

  const deleteMutation = useMutation({
    mutationFn: () => clientsApi.deleteClient(clientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      navigate({ to: '/dashboard/clients' })
    },
    onError: (err: Error) => setDeleteError(err.message),
  })

  return (
    <section className="border border-orange bg-paper">
      <div className="px-6 py-4 border-b border-orange">
        <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-orange">Danger zone</p>
      </div>
      <div className="px-6 py-5">
        <p className="font-mono text-[11px] text-ink-soft mb-4">Deleting a client is permanent and cannot be undone.</p>
        {deleteError && <p className="font-mono text-[10px] text-orange mb-3">{deleteError}</p>}
        {deleteConfirm ? (
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] text-ink-soft uppercase tracking-wide">Are you sure?</span>
            <button onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}
              className="bg-orange text-white px-4 py-2 font-mono text-[10px] tracking-[0.08em] uppercase hover:opacity-80 disabled:opacity-40 transition-opacity">
              {deleteMutation.isPending ? 'Deleting…' : 'Yes, delete'}
            </button>
            <button onClick={() => setDeleteConfirm(false)}
              className="border border-ink px-4 py-2 font-mono text-[10px] tracking-[0.08em] uppercase text-ink-soft hover:text-ink transition-colors">
              Cancel
            </button>
          </div>
        ) : (
          <button onClick={() => setDeleteConfirm(true)}
            className="border border-orange text-orange px-4 py-2 font-mono text-[10px] tracking-[0.08em] uppercase hover:bg-orange hover:text-white transition-colors">
            Delete Client
          </button>
        )}
      </div>
    </section>
  )
}
